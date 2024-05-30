import { useEffect, useRef, useState } from "react";

export class Module<M, D> {
  readonly metadata: M;

  #load: () => Promise<D>;

  constructor({ metadata, load }: { metadata: M; load: () => Promise<D> }) {
    this.metadata = metadata;
    this.#load = load;
  }

  async load(): Promise<D & M> {
    return {
      ...(await this.#load()),
      ...this.metadata,
    };
  }
}

export const useModule = <M, D>(module: Module<M, D>): (D & M) | undefined => {
  const [loadedModule, setLoadedModule] = useState<D & M>();
  const moduleRef = useRef<Module<M, D>>();
  moduleRef.current = module;

  useEffect(() => {
    if (!module) {
      setLoadedModule(undefined);
      return;
    }

    module.load().then((loadedModule) => {
      // ignore if module has changed in the meantime
      if (module !== moduleRef.current) {
        return;
      }
      setLoadedModule(loadedModule);
    });
  }, [module]);

  return module ? loadedModule : undefined;
};
