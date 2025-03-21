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

export class CityExecution implements Execution {
  private player: Player;
  private mg: Game;
  private city: Unit;
  private capital: Unit;
  private enterprise: Unit;
  private active: boolean = true;

  constructor(
    private ownerId: PlayerID,
    private tile: TileRef,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    if (!mg.hasPlayer(this.ownerId)) {
      console.warn(`CityExecution: player ${this.ownerId} not found`);
      this.active = false;
      return;
    }
    this.player = mg.player(this.ownerId);
  }

  tick(ticks: number): void {
    if (this.city == null) {
      const spawnTile = this.player.canBuild(UnitType.City, this.tile);
      if (spawnTile == false) {
        consolex.warn("cannot build city");
        this.active = false;
        return;
      }
      this.city = this.player.buildUnit(UnitType.City, 0, spawnTile);
    }
    if (!this.city.isActive()) {
      this.active = false;
      return;
    }

    if (this.capital == null) {
      const spawnTile = this.player.canBuild(UnitType.Capital, this.tile);
      if (spawnTile == false) {
        consolex.warn("cannot build capital");
        this.active = false;
        return;
      }
      this.capital = this.player.buildUnit(UnitType.Capital, 0, spawnTile);
    }
    if (!this.capital.isActive()) {
      this.active = false;
      return;
    }

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
