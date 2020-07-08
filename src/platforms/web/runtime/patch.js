/* @flow */

import * as nodeOps from 'web/runtime/node-ops'
import { createPatchFunction } from 'core/vdom/patch'
import baseModules from 'core/vdom/modules/index'
import platformModules from 'web/runtime/modules/index'

// the directive module should be applied last, after all
// built-in modules have been applied.
const modules = platformModules.concat(baseModules)

// createPatchFunction 用以创建patch方法，通过传入不同平台的接口来抹平平台差异
export const patch: Function = createPatchFunction({ nodeOps, modules })
