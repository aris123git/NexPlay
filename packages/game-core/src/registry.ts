import type { AnyGameModule } from './types.js';

/**
 * Registre central des modules de jeu.
 * L’API charge les modules au boot ; le cœur reste agnostique.
 */
export class GameRegistry {
  private readonly modules = new Map<string, AnyGameModule>();

  register(module: AnyGameModule): void {
    if (this.modules.has(module.id)) {
      throw new Error(`Game already registered: ${module.id}`);
    }
    if (module.minPlayers < 1 || module.maxPlayers < module.minPlayers) {
      throw new Error(`Invalid player range for game: ${module.id}`);
    }
    this.modules.set(module.id, module);
  }

  get(id: string): AnyGameModule | undefined {
    return this.modules.get(id);
  }

  require(id: string): AnyGameModule {
    const m = this.get(id);
    if (!m) throw new Error(`Unknown game: ${id}`);
    return m;
  }

  list(): AnyGameModule[] {
    return [...this.modules.values()];
  }

  has(id: string): boolean {
    return this.modules.has(id);
  }
}

export const createRegistry = (): GameRegistry => new GameRegistry();
