/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  noop
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
/**
 * 观察者
 * expression 结果变化时，调用cb
 */
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  /**
   * 
   * @param {*} vm 
   * @param {*} expOrFn 函数或字符串（对象的路径，主要给watch用）
   * @param {*} cb 回调函数
   * @param {*} options 配置项
   * @param {*} isRenderWatcher 
   */
  constructor (
    vm: Component,
    expOrFn: string | Function, 
    cb: Function,
    options?: ?Object,
    isRenderWatcher?: boolean
  ) {
    this.vm = vm
    if (isRenderWatcher) {
      vm._watcher = this
    }
    // 实例_watchers加入此watcher
    vm._watchers.push(this)
    // options
    // TODO
    if (options) {
      // TODO
      this.deep = !!options.deep
      // TODO
      this.user = !!options.user
      // TODO
      this.lazy = !!options.lazy
      // TODO
      this.sync = !!options.sync
      // TODO
      this.before = options.before
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    // TODO
    this.cb = cb
    this.id = ++uid // uid for batching
    // TODO
    this.active = true
    // TODO
    this.dirty = this.lazy // for lazy watchers
    // TODO
    this.deps = [] // 上次的依赖
    // TODO
    this.newDeps = [] // 本次的依赖
    // TODO
    this.depIds = new Set() // 依赖的id
    // TODO
    this.newDepIds = new Set()
    // TODO
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // parse expression for getter 解析getter
    // TODO
    // computed时getter时函数
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
      // watch时getter是字符串（getter执行获取的是vm上的属性值）
    } else {
      // getter: 获取对象expOrFn的值
      this.getter = parsePath(expOrFn)
      // 不符合规则时parsePath返回空
      if (!this.getter) {
        this.getter = noop
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    // lazy 时不取值
    // TODO 作用
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   * 执行getter，收集依赖
   */
  get () {
    // Dep.target 推入当前 watcher
    // TODO 作用
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      // 调用getter，这个过程中对data等的调用，就会收集到这个watcher
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      // 收集对象或数组其所有深度的依赖id，保存在traverse.js模块的seenObjects对象中
      // TODO 作用
      if (this.deep) {
        traverse(value)
      }
      // 推出
      popTarget()
      // 依赖更新，清除不必要的订阅 TODO
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   */
  addDep (dep: Dep) {
    const id = dep.id
    // newDepIds记录dep添加的watcher，用于检测是否已被添加，比遍历快
    // 本次没有添加过此依赖，加入记录
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      // 上次如果添加过此依赖，不再重复收集此watcher
      if (!this.depIds.has(id)) {
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   */
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  update () {
    /* istanbul ignore else */
    if (this.lazy) { // computed 等重新置为dirty状态
      this.dirty = true
    } else if (this.sync) { // TODO
      this.run()
    } else { // TODO 插入vue调度队列之类的，估计异步更新、nextTick依赖于此
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  run () {
    if (this.active) {
      const value = this.get()
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value
        this.value = value
        if (this.user) {
          try {
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   * 执行get，只有lazy watcher才会调用
   */
  evaluate () {
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   * 所有依赖收集器收集此watcher
   */
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}
