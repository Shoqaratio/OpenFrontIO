import { Colord } from "colord";
import { Theme } from "../../../core/configuration/Config";
import { Unit, UnitType, Player } from "../../../core/game/Game";
import { Layer } from "./Layer";
import { EventBus } from "../../../core/EventBus";
import { AlternateViewEvent, MouseUpEvent } from "../../InputHandler";
import { ClientID } from "../../../core/Schemas";
import { GameView, PlayerView, UnitView } from "../../../core/game/GameView";
import {
  euclDistFN,
  manhattanDistFN,
  TileRef,
} from "../../../core/game/GameMap";
import { GameUpdateType } from "../../../core/game/GameUpdates";
import { SelectedUnits, UnitSelectionEvent } from "../SelectedUnits";
import { TransformHandler } from "../TransformHandler";

enum Relationship {
  Self,
  Ally,
  Enemy,
}

export class UnitLayer implements Layer {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;

  private boatToTrail = new Map<UnitView, Set<TileRef>>();

  private theme: Theme = null;

  private alternateView = false;

  private myPlayer: PlayerView | null = null;

  private oldShellTile = new Map<UnitView, TileRef>();

  private selectedUnits: SelectedUnits;
  private selectionAnimTime = 0;
  private transformHandler: TransformHandler;

  // Configuration for unit selection
  private readonly WARSHIP_SELECTION_RADIUS = 3; // Radius in game cells for warship selection hit zone

  constructor(
    private game: GameView,
    private eventBus: EventBus,
    private clientID: ClientID,
    transformHandler: TransformHandler,
  ) {
    this.theme = game.config().theme();
    this.selectedUnits = new SelectedUnits(eventBus);
    this.transformHandler = transformHandler;
  }

  shouldTransform(): boolean {
    return true;
  }

  tick() {
    if (this.myPlayer == null) {
      this.myPlayer = this.game.playerByClientID(this.clientID);
    }
    this.game.updatesSinceLastTick()?.[GameUpdateType.Unit]?.forEach((unit) => {
      this.onUnitEvent(this.game.unit(unit.id));
    });

    // Update the selection animation time
    this.selectionAnimTime = (this.selectionAnimTime + 1) % 60;

    // If there's a selected warship, redraw to update the selection box animation
    if (this.selectedUnits.hasSelectedUnitOfType(UnitType.Warship)) {
      this.redrawSelectedUnit(this.selectedUnits.getSelectedUnit());
    }
  }

  init() {
    this.eventBus.on(AlternateViewEvent, (e) => this.onAlternativeViewEvent(e));
    this.eventBus.on(MouseUpEvent, (e) => this.onMouseUp(e));
    this.eventBus.on(UnitSelectionEvent, (e) => this.onUnitSelection(e));
    this.redraw();
  }

  /**
   * Find warships near the given cell within a configurable radius
   * @param cell The cell to check
   * @returns Array of warships in range, sorted by distance (closest first)
   */
  private findWarshipsNearCell(cell: { x: number; y: number }): UnitView[] {
    const clickRef = this.game.ref(cell.x, cell.y);

    return this.game
      .units(UnitType.Warship)
      .filter(
        (unit) =>
          unit.isActive() &&
          this.game.manhattanDist(unit.tile(), clickRef) <=
            this.WARSHIP_SELECTION_RADIUS,
      )
      .sort((a, b) => {
        // Sort by distance (closest first)
        const distA = this.game.manhattanDist(a.tile(), clickRef);
        const distB = this.game.manhattanDist(b.tile(), clickRef);
        return distA - distB;
      });
  }

  private onMouseUp(event: MouseUpEvent) {
    // Convert screen coordinates to world coordinates
    const cell = this.transformHandler.screenToWorldCoordinates(
      event.x,
      event.y,
    );

    // Find warships near this cell, sorted by distance
    const nearbyWarships = this.findWarshipsNearCell(cell);

    if (nearbyWarships.length > 0) {
      // Select/deselect the closest warship
      this.selectedUnits.toggleUnitSelection(nearbyWarships[0]);
    } else if (this.selectedUnits.getSelectedUnit()) {
      // If clicked elsewhere and there's a selection, deselect it
      this.selectedUnits.deselectCurrentUnit();
    }
  }

  private onUnitSelection(event: UnitSelectionEvent) {
    if (event.unit && event.unit.type() === UnitType.Warship) {
      if (event.isSelected) {
        // Highlight the selected warship
        this.redrawSelectedUnit(event.unit);
      } else {
        // Remove the highlight
        this.onUnitEvent(event.unit);

        // Also clear any lingering selection box
        if (this.lastSelectionBoxCenter) {
          const { x, y, size } = this.lastSelectionBoxCenter;
          for (let px = x - size; px <= x + size; px++) {
            for (let py = y - size; py <= y + size; py++) {
              if (
                px === x - size ||
                px === x + size ||
                py === y - size ||
                py === y + size
              ) {
                this.clearCell(px, py);
              }
            }
          }
          this.lastSelectionBoxCenter = null;
        }
      }
    }
  }

  /**
   * Handle unit deactivation or destruction
   * If the selected unit is removed from the game, deselect it
   */
  private handleUnitDeactivation(unit: UnitView) {
    if (this.selectedUnits.isSelected(unit) && !unit.isActive()) {
      // Clear the selection box before deselecting
      if (
        this.lastSelectionBoxCenter &&
        this.lastSelectionBoxCenter.unit === unit
      ) {
        const { x, y, size } = this.lastSelectionBoxCenter;
        for (let px = x - size; px <= x + size; px++) {
          for (let py = y - size; py <= y + size; py++) {
            if (
              px === x - size ||
              px === x + size ||
              py === y - size ||
              py === y + size
            ) {
              this.clearCell(px, py);
            }
          }
        }
        this.lastSelectionBoxCenter = null;
      }

      this.selectedUnits.deselectCurrentUnit();
    }
  }

  private redrawSelectedUnit(unit: UnitView) {
    if (unit && unit.type() === UnitType.Warship && unit.isActive()) {
      this.onUnitEvent(unit);
    }
  }

  renderLayer(context: CanvasRenderingContext2D) {
    context.drawImage(
      this.canvas,
      -this.game.width() / 2,
      -this.game.height() / 2,
      this.game.width(),
      this.game.height(),
    );
  }

  onAlternativeViewEvent(event: AlternateViewEvent) {
    this.alternateView = event.alternateView;
    this.redraw();
  }

  redraw() {
    this.canvas = document.createElement("canvas");
    this.context = this.canvas.getContext("2d");

    this.canvas.width = this.game.width();
    this.canvas.height = this.game.height();
    this.game
      ?.updatesSinceLastTick()
      ?.[GameUpdateType.Unit]?.forEach((unit) => {
        this.onUnitEvent(this.game.unit(unit.id));
      });
  }

  private relationship(unit: UnitView): Relationship {
    if (this.myPlayer == null) {
      return Relationship.Enemy;
    }
    if (this.myPlayer == unit.owner()) {
      return Relationship.Self;
    }
    if (this.myPlayer.isAlliedWith(unit.owner())) {
      return Relationship.Ally;
    }
    return Relationship.Enemy;
  }

  onUnitEvent(unit: UnitView) {
    // Check if unit was deactivated
    if (!unit.isActive()) {
      this.handleUnitDeactivation(unit);
    }

    switch (unit.type()) {
      case UnitType.TransportShip:
        this.handleBoatEvent(unit);
        break;
      case UnitType.Warship:
        this.handleWarShipEvent(unit);
        break;
      case UnitType.Shell:
        this.handleShellEvent(unit);
        break;
      case UnitType.TradeShip:
        this.handleTradeShipEvent(unit);
        break;
      case UnitType.MIRVWarhead:
        this.handleMIRVWarhead(unit);
        break;
      case UnitType.AtomBomb:
      case UnitType.HydrogenBomb:
      case UnitType.MIRV:
        this.handleNuke(unit);
        break;
    }
  }

  private handleWarShipEvent(unit: UnitView) {
    const rel = this.relationship(unit);

    // Clear previous area
    for (const t of this.game.bfs(
      unit.lastTile(),
      euclDistFN(unit.lastTile(), 6),
    )) {
      this.clearCell(this.game.x(t), this.game.y(t));
    }

    if (!unit.isActive()) {
      return;
    }

    // Paint outer territory
    for (const t of this.game.bfs(unit.tile(), euclDistFN(unit.tile(), 5))) {
      this.paintCell(
        this.game.x(t),
        this.game.y(t),
        rel,
        this.theme.territoryColor(unit.owner().info()),
        255,
      );
    }

    // Paint border
    for (const t of this.game.bfs(
      unit.tile(),
      manhattanDistFN(unit.tile(), 4),
    )) {
      this.paintCell(
        this.game.x(t),
        this.game.y(t),
        rel,
        this.theme.borderColor(unit.owner().info()),
        255,
      );
    }

    // Paint inner territory
    for (const t of this.game.bfs(unit.tile(), euclDistFN(unit.tile(), 1))) {
      this.paintCell(
        this.game.x(t),
        this.game.y(t),
        rel,
        this.theme.territoryColor(unit.owner().info()),
        255,
      );
    }

    // If this is a selected warship, draw the selection box
    if (this.selectedUnits.isSelected(unit)) {
      this.drawSelectionBox(unit);
    }
  }

  // Keep track of previous selection box positions for cleanup
  private lastSelectionBoxCenter: {
    unit: UnitView;
    x: number;
    y: number;
    size: number;
  } | null = null;

  // Visual settings for selection
  private readonly SELECTION_BOX_SIZE = 6; // Size of the selection box (should be larger than the warship)

  /**
   * Draw a selection box around the warship
   */
  private drawSelectionBox(unit: UnitView) {
    // Use the configured selection box size
    const selectionSize = this.SELECTION_BOX_SIZE;

    // Calculate pulsating effect based on animation time (25% variation in opacity)
    const baseOpacity = 200;
    const pulseAmount = 55;
    const opacity =
      baseOpacity + Math.sin(this.selectionAnimTime * 0.1) * pulseAmount;

    // Get the warship's owner color for the box
    const ownerColor = this.theme.territoryColor(unit.owner().info());

    // Create a brighter version of the owner color for the selection
    const selectionColor = ownerColor.lighten(0.2);

    // Get current center position
    const center = unit.tile();
    const centerX = this.game.x(center);
    const centerY = this.game.y(center);

    // Clear previous selection box if it exists and is different from current position
    if (
      this.lastSelectionBoxCenter &&
      (this.lastSelectionBoxCenter.x !== centerX ||
        this.lastSelectionBoxCenter.y !== centerY ||
        this.lastSelectionBoxCenter.unit !== unit)
    ) {
      const lastSize = this.lastSelectionBoxCenter.size;
      const lastX = this.lastSelectionBoxCenter.x;
      const lastY = this.lastSelectionBoxCenter.y;

      // Clear the previous selection box
      for (let x = lastX - lastSize; x <= lastX + lastSize; x++) {
        for (let y = lastY - lastSize; y <= lastY + lastSize; y++) {
          if (
            x === lastX - lastSize ||
            x === lastX + lastSize ||
            y === lastY - lastSize ||
            y === lastY + lastSize
          ) {
            this.clearCell(x, y);
          }
        }
      }

      // Redraw the tiles at the previous location
      for (const t of this.game.bfs(
        this.lastSelectionBoxCenter.unit.lastTile(),
        euclDistFN(this.lastSelectionBoxCenter.unit.lastTile(), 5),
      )) {
        const tileX = this.game.x(t);
        const tileY = this.game.y(t);
        // Only redraw if it's near the selection border
        if (
          Math.abs(tileX - lastX) <= lastSize + 1 &&
          Math.abs(tileY - lastY) <= lastSize + 1
        ) {
          if (this.game.hasOwner(t)) {
            const owner = this.game.owner(t);
            if (owner.isPlayer()) {
              this.paintCell(
                tileX,
                tileY,
                this.relationship(unit),
                this.theme.territoryColor(owner.info()),
                255,
              );
            }
          }
        }
      }
    }

    // Draw the selection box
    for (let x = centerX - selectionSize; x <= centerX + selectionSize; x++) {
      for (let y = centerY - selectionSize; y <= centerY + selectionSize; y++) {
        // Only draw if it's on the border (not inside or outside the box)
        if (
          x === centerX - selectionSize ||
          x === centerX + selectionSize ||
          y === centerY - selectionSize ||
          y === centerY + selectionSize
        ) {
          // Create a dashed effect by only drawing some pixels
          const dashPattern = (x + y) % 2 === 0;
          if (dashPattern) {
            this.paintCell(
              x,
              y,
              this.relationship(unit),
              selectionColor,
              opacity,
            );
          }
        }
      }
    }

    // Store current selection box position for next cleanup
    this.lastSelectionBoxCenter = {
      unit,
      x: centerX,
      y: centerY,
      size: selectionSize,
    };
  }

  private handleShellEvent(unit: UnitView) {
    const rel = this.relationship(unit);

    // Clear current and previous positions
    this.clearCell(this.game.x(unit.lastTile()), this.game.y(unit.lastTile()));
    if (this.oldShellTile.has(unit)) {
      const oldTile = this.oldShellTile.get(unit);
      this.clearCell(this.game.x(oldTile), this.game.y(oldTile));
    }

    this.oldShellTile.set(unit, unit.lastTile());
    if (!unit.isActive()) {
      return;
    }

    // Paint current and previous positions
    this.paintCell(
      this.game.x(unit.tile()),
      this.game.y(unit.tile()),
      rel,
      this.theme.borderColor(unit.owner().info()),
      255,
    );
    this.paintCell(
      this.game.x(unit.lastTile()),
      this.game.y(unit.lastTile()),
      rel,
      this.theme.borderColor(unit.owner().info()),
      255,
    );
  }

  private handleNuke(unit: UnitView) {
    const rel = this.relationship(unit);
    let range = 0;
    switch (unit.type()) {
      case UnitType.AtomBomb:
        range = 4;
        break;
      case UnitType.HydrogenBomb:
        range = 6;
        break;
      case UnitType.MIRV:
        range = 9;
        break;
    }

    // Clear previous area
    for (const t of this.game.bfs(
      unit.lastTile(),
      euclDistFN(unit.lastTile(), range),
    )) {
      this.clearCell(this.game.x(t), this.game.y(t));
    }

    if (unit.isActive()) {
      for (const t of this.game.bfs(
        unit.tile(),
        euclDistFN(unit.tile(), range),
      )) {
        this.paintCell(
          this.game.x(t),
          this.game.y(t),
          rel,
          this.theme.spawnHighlightColor(),
          255,
        );
      }
      for (const t of this.game.bfs(unit.tile(), euclDistFN(unit.tile(), 2))) {
        this.paintCell(
          this.game.x(t),
          this.game.y(t),
          rel,
          this.theme.borderColor(unit.owner().info()),
          255,
        );
      }
    }
  }

  private handleMIRVWarhead(unit: UnitView) {
    const rel = this.relationship(unit);

    this.clearCell(this.game.x(unit.lastTile()), this.game.y(unit.lastTile()));

    if (unit.isActive()) {
      // Paint area
      this.paintCell(
        this.game.x(unit.tile()),
        this.game.y(unit.tile()),
        rel,
        this.theme.borderColor(unit.owner().info()),
        255,
      );
    }
  }

  private handleTradeShipEvent(unit: UnitView) {
    const rel = this.relationship(unit);

    // Clear previous area
    for (const t of this.game.bfs(
      unit.lastTile(),
      euclDistFN(unit.lastTile(), 3),
    )) {
      this.clearCell(this.game.x(t), this.game.y(t));
    }

    if (unit.isActive()) {
      // Paint territory
      for (const t of this.game.bfs(
        unit.tile(),
        manhattanDistFN(unit.tile(), 2),
      )) {
        this.paintCell(
          this.game.x(t),
          this.game.y(t),
          rel,
          this.theme.territoryColor(unit.owner().info()),
          255,
        );
      }

      // Paint border
      for (const t of this.game.bfs(
        unit.tile(),
        manhattanDistFN(unit.tile(), 1),
      )) {
        this.paintCell(
          this.game.x(t),
          this.game.y(t),
          rel,
          this.theme.borderColor(unit.owner().info()),
          255,
        );
      }
    }
  }

  private handleBoatEvent(unit: UnitView) {
    const rel = this.relationship(unit);

    if (!this.boatToTrail.has(unit)) {
      this.boatToTrail.set(unit, new Set<TileRef>());
    }
    const trail = this.boatToTrail.get(unit);
    trail.add(unit.lastTile());

    // Clear previous area
    for (const t of this.game.bfs(
      unit.lastTile(),
      manhattanDistFN(unit.lastTile(), 3),
    )) {
      this.clearCell(this.game.x(t), this.game.y(t));
    }

    if (unit.isActive()) {
      // Paint trail
      for (const t of trail) {
        this.paintCell(
          this.game.x(t),
          this.game.y(t),
          rel,
          this.theme.territoryColor(unit.owner().info()),
          150,
        );
      }

      // Paint border
      for (const t of this.game.bfs(
        unit.tile(),
        manhattanDistFN(unit.tile(), 2),
      )) {
        this.paintCell(
          this.game.x(t),
          this.game.y(t),
          rel,
          this.theme.borderColor(unit.owner().info()),
          255,
        );
      }

      // Paint territory
      for (const t of this.game.bfs(
        unit.tile(),
        manhattanDistFN(unit.tile(), 1),
      )) {
        this.paintCell(
          this.game.x(t),
          this.game.y(t),
          rel,
          this.theme.territoryColor(unit.owner().info()),
          255,
        );
      }
    } else {
      for (const t of trail) {
        this.clearCell(this.game.x(t), this.game.y(t));
      }
      this.boatToTrail.delete(unit);
    }
  }

  paintCell(
    x: number,
    y: number,
    relationship: Relationship,
    color: Colord,
    alpha: number,
  ) {
    this.clearCell(x, y);
    if (this.alternateView) {
      switch (relationship) {
        case Relationship.Self:
          this.context.fillStyle = this.theme.selfColor().toRgbString();
          break;
        case Relationship.Ally:
          this.context.fillStyle = this.theme.allyColor().toRgbString();
          break;
        case Relationship.Enemy:
          this.context.fillStyle = this.theme.enemyColor().toRgbString();
          break;
      }
    } else {
      this.context.fillStyle = color.alpha(alpha / 255).toRgbString();
    }
    this.context.fillRect(x, y, 1, 1);
  }

  clearCell(x: number, y: number) {
    this.context.clearRect(x, y, 1, 1);
  }
}
