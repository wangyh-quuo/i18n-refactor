import * as _traverse from '@babel/traverse';
import type { TraverseOptions, Node } from '@babel/traverse';

type TraverseFn = (
  node: Node,
  opts: TraverseOptions,
  scope?: any,
  state?: any,
  parentPath?: any
) => void;

const traverse: TraverseFn =
  // CJS + ESM + bundler 全兼容
  ((_traverse as any).default?.default ??
   (_traverse as any).default ??
   _traverse) as TraverseFn;

export default traverse;
