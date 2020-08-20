/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'
import config from '../config'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 * 依赖对象
 */
export default class Dep {
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>; // wathers

  constructor () {
    this.id = uid++
    this.subs = []
  }

  addSub (sub: Watcher) {
    this.subs.push(sub)
  }

  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }

  // 通过当前唯一全局watcher，将watcher添加到subs
  // TODO 为什么这么绕
  // 1. 某一个时候 Dep.target 被赋值watcer TODO 
  // 2. dep.depend -> watcher.addDep -> 存储依赖id -> dep.addSub -> watcher添加到dep.subs中
  depend () {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }

  notify () {
    // stabilize the subscriber list first
    const subs = this.subs.slice()
    // TODO 按dep 创建的顺序执行？
    if (process.env.NODE_ENV !== 'production' && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      subs.sort((a, b) => a.id - b.id)
    }
    // 调用watcher update更新
    for (let i = 0, l = subs.length; i < l; i++) {
      // TODO 更新的过程
      subs[i].update()
    }
  }
}

// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.
// 全局target唯一watcher
Dep.target = null
const targetStack = []

export function pushTarget (target: ?Watcher) {
  targetStack.push(target)
  Dep.target = target
}

export function popTarget () {
  targetStack.pop()
  Dep.target = targetStack[targetStack.length - 1]
}
