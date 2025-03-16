import { consolex } from "../Consolex";
import {
  Execution,
  Game,
  Player,
  Unit,
  PlayerID,
  UnitType,
} from "../game/Game";
import { TileRef } from "../game/GameMap";

export class EnterpriseExecution implements Execution {
  private player: Player;
  private mg: Game;
  private enterprise: Unit;
  private active: boolean = true;

  constructor(
    private ownerId: PlayerID,
    private tile: TileRef,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    if (!mg.hasPlayer(this.ownerId)) {
      console.warn(`EnterpriseExecution: player ${this.ownerId} not found`);
      this.active = false;
      return;
    }
    this.player = mg.player(this.ownerId);
  }

  tick(ticks: number): void {
    if (this.enterprise == null) {
      const spawnTile = this.player.canBuild(UnitType.Enterprise, this.tile);
      if (spawnTile == false) {
        consolex.warn("cannot build enterprise");
        this.active = false;
        return;
      }
      this.enterprise = this.player.buildUnit(
        UnitType.Enterprise,
        0,
        spawnTile,
      );
    }
    if (!this.enterprise.isActive()) {
      this.active = false;
      return;
    }
  }

  owner(): Player {
    return null;
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
