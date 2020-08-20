/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 * 
 * 通过new Observer构造器给对象或数组添加深层监听，实例包含目标和依赖（对该目标的依赖watchers）
 * 对象监听：对象和所有深层子对象都添加监听
 * 数组监听：数组中对象成员深层监听
 */
export class Observer {
  value: any; // 监听的目标
  dep: Dep; // 依赖
  vmCount: number; // TODO number of vms that have this object as root $data

  constructor (value: any) {
    this.value = value
    this.dep = new Dep()
    this.vmCount = 0
    def(value, '__ob__', this) // 添加__ob__属性，表示已被观察
    // 数组则递归
    if (Array.isArray(value)) {
      // TODO
      if (hasProto) {
        protoAugment(value, arrayMethods)
      } else {
        copyAugment(value, arrayMethods, arrayKeys)
      }
      this.observeArray(value)
    // 对象，添加get set监听
    } else {
      this.walk(value)
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 * 通过Observer给目标添中对象或数组添加深层监听，返回监听实例
 * 这里主要避免重复监听
 */
export function observe (value: any, asRootData: ?boolean): Observer | void {
  // isObject判断 value 对象或数组
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  // ob 会被Observer添加到value对象上，__ob__
  let ob: Observer | void
  // __ob__已是观察对象
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    // TODO shouldObserve作为全局开关，为什么这么设计，而不是作为参数？
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    // isExtensible判断对象是否可扩展，freeze seal的对象不可扩展（添加属性）
    Object.isExtensible(value) &&
    // 避免监听vue实例对象
    !value._isVue
  ) {
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 * 添加一个属性并监听其变化（监听属性）
 * @param {*} obj 
 * @param {*} key 
 * @param {*} val 
 * @param {*} customSetter 
 * @param {*} shallow 浅层监听，不递归子属性
 */
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  // Dep实例，这里作为闭包里的变量，后续get set时使用
  const dep = new Dep()

  // 跳过不可重写的属性
  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  // 可能本身有get set
  const getter = property && property.get
  const setter = property && property.set
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }
  // 默认将val(如果对象或数组)添加监听
  let childOb = !shallow && observe(val)
  // 添加getter setter
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    // 依赖收集 TODO
    get: function reactiveGetter () {
      const value = getter ? getter.call(obj) : val
      // TODO 跟踪这个过程
      // render过程中，在构建vnode时会通过new Watcher将Dep.target设置为watcher实例，接着vnode在_render时调用此属性，走到下一步
      if (Dep.target) {
        // 依赖收集（观察者模式）：将watcher实例添加到dep.subs中（后续set时通过watcher来处理其他事, 订阅 -> 通知）
        // 后续set值时，遍历dep.subs，通知依赖此属性的所有vnode进行更新
        dep.depend()
        // 值是数组时，$set等操作时触发更新
        // 首先value上有__ob__与childOb是同一个值
        // 这里收集依赖，后续在数组的操作时($set等)，触发更新
        // 因数组的有些操作是无法触发更新的
        if (childOb) {
          childOb.dep.depend()
          // get返回值的值也需要监听：因为原来的getter取的值没有被监听
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    // 派发更新
    set: function reactiveSetter (newVal) {
      // 原值
      // 有getter时，值是通过getter获取的（getter还有操作）
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      // 值未更新（NaN的情况需要特殊判断）跳过set
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      // 执行传入的自定义setter
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      // 有getter没有setter不触发更新，似乎computed里经常这么用
      if (getter && !setter) return
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      // 监听值：如果值是对象/数组，也需要监听（其实就是子对象）
      childOb = !shallow && observe(newVal)
      // TODO 过程 watcher做了哪些事
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set (target: Array<any> | Object, key: any, val: any): any {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  if (!ob) {
    target[key] = val
    return val
  }
  defineReactive(ob.value, key, val)
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 * 对数组中的对象成员进行监听
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
