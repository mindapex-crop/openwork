/**
 * react-test-renderer 最小类型声明。
 * React 19 起官方不再发布配套的 @types/react-test-renderer，
 * 这里仅声明测试用到的 API 子集。
 */
declare module "react-test-renderer" {
  import type { ReactElement } from "react";

  export interface ReactTestInstance {
    type: unknown;
    props: Record<string, unknown>;
    children: Array<ReactTestInstance | string | number>;
    root: ReactTestInstance;
    findAll(predicate: (node: ReactTestInstance) => boolean): ReactTestInstance[];
    findByType(type: unknown): ReactTestInstance;
    findByProps(props: Record<string, unknown>): ReactTestInstance;
  }

  export interface ReactTestRendererJSON {
    type: string;
    props: Record<string, unknown>;
    children: Array<ReactTestRendererJSON | string> | null;
  }

  export interface ReactTestRenderer {
    root: ReactTestInstance;
    toJSON(): ReactTestRendererJSON | Array<ReactTestRendererJSON> | null;
    toTree(): unknown;
    update(element: ReactElement): void;
    unmount(): void;
  }

  export function create(element: ReactElement): ReactTestRenderer;
  export function act(
    callback: () => void | Promise<void>,
  ): Promise<void> | void;
}
