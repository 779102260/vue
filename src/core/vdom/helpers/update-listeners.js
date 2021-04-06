/* @flow */

import {
  warn,
  invokeWithErrorHandling
} from 'core/util/index'
import {
  cached,
  isUndef,
  isTrue,
  isPlainObject
} from 'shared/util'

/**
 * 格式化事件名称，事件名分解成：name once capture passive
 */
const normalizeEvent = cached((name: string): {
  name: string,
  once: boolean,
  capture: boolean,
  passive: boolean,
  handler?: Function,
  params?: Array<any>
} => {
  const passive = name.charAt(0) === '&'
  name = passive ? name.slice(1) : name
  const once = name.charAt(0) === '~' // Prefixed last, checked first
  name = once ? name.slice(1) : name
  const capture = name.charAt(0) === '!'
  name = capture ? name.slice(1) : name
  return {
    name,
    once,
    capture,
    passive
  }
})

/**
 * 创建事件方法的调用函数
 * @param {*} fns 
 * @param {*} vm 
 */
export function createFnInvoker (fns: Function | Array<Function>, vm: ?Component): Function {
  function invoker () {
    const fns = invoker.fns
    if (Array.isArray(fns)) {
      const cloned = fns.slice()
      for (let i = 0; i < cloned.length; i++) {
        invokeWithErrorHandling(cloned[i], null, arguments, vm, `v-on handler`)
      }
    } else {
      // return handler return value for single handlers
      return invokeWithErrorHandling(fns, null, arguments, vm, `v-on handler`)
    }
  }
  // invoker 用于调用fns
  // fns 保存着待调用的事件方法
  invoker.fns = fns
  return invoker
}

/**
 * 对比新旧事件，进行diff，将新加入的进行注册，已丢弃的移除
 * @param {*} on 父组件中给组件绑定的事件
 * @param {*} oldOn 原有的事件
 * @param {*} add 添加事件
 * @param {*} remove 移除事件
 * @param {*} createOnceHandler  
 * @param {*} vm 组件实例
 */
export function updateListeners (
  on: Object,
  oldOn: Object,
  add: Function,
  remove: Function,
  createOnceHandler: Function,
  vm: Component
) {
  let name, def, cur, old, event
  for (name in on) {
    // 新事件值
    def = cur = on[name]
    // 旧事件值
    old = oldOn[name]
    // 格式化
    event = normalizeEvent(name)
    /* istanbul ignore if */
    if (__WEEX__ && isPlainObject(def)) {
      cur = def.handler
      event.params = def.params
    }
    // 新事件值如果是undefined -> 报错
    if (isUndef(cur)) {
      process.env.NODE_ENV !== 'production' && warn(
        `Invalid handler for event "${event.name}": got ` + String(cur),
        vm
      )
    // 旧事件如果不存在，创建事件值
    } else if (isUndef(old)) {
      if (isUndef(cur.fns)) { // fns存的是事件执行的方法
        cur = on[name] = createFnInvoker(cur, vm)
      }
      if (isTrue(event.once)) { // once
        cur = on[name] = createOnceHandler(event.name, cur, event.capture)
      }
      // 将事件保存到_events中
      add(event.name, cur, event.capture, event.passive, event.params)
    // 新 旧 不相等
    } else if (cur !== old) {
      old.fns = cur
      on[name] = old
    }
  }
  // 从_events中移除新事件不存在的事件
  for (name in oldOn) {
    if (isUndef(on[name])) {
      event = normalizeEvent(name)
      remove(event.name, oldOn[name], event.capture)
    }
  }
}
