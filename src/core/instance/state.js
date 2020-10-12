/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute
} from '../util/index'

const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}
// proxy(vm, `_data`, key)
/**
 * 将目标(target和其子对象(sourceKey)的某个属性(key)建立代理，使得可以有效减少对象访问太深的问题
 * @param {*} target 
 * @param {*} sourceKey 
 * @param {*} key 
 */
export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

export function initState (vm: Component) {
  // 添加_watchers属性 TODO
  vm._watchers = []
  // 配置项
  const opts = vm.$options
  // 初始化 props
  if (opts.props) initProps(vm, opts.props)
  // 初始化 methods 
  if (opts.methods) initMethods(vm, opts.methods)
  // 初始化 data NOTE here 数据驱动原理
  if (opts.data) {
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }
  // 初始化computed TODO
  if (opts.computed) initComputed(vm, opts.computed)
  // 初始化watched TODO
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}

/**
 * 根据props配置，初始化vm._props对象，并进行监听
 * @param {*} vm 
 * @param {*} propsOptions 
 */
function initProps (vm: Component, propsOptions: Object) {
  // TODO propsOptions是props配置，propsData是？
  const propsData = vm.$options.propsData || {}
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  // 缓存props的key，后续需要判断某个变量在不在prop中 TODO 哪里需要用？
  const keys = vm.$options._propKeys = []
  // 没有父节点就是root
  const isRoot = !vm.$parent
  // root instance props should be converted
  // TODO
  if (!isRoot) {
    toggleObserving(false)
  }
  // 遍历props配置项
  for (const key in propsOptions) {
    // 1. 缓存key
    keys.push(key)
    // 2. 校验并获取值
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    // 3. props添加属性并监听变化
    if (process.env.NODE_ENV !== 'production') {
      const hyphenatedKey = hyphenate(key)
      if (isReservedAttribute(hyphenatedKey) ||
          config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(props, key, value, () => {
        if (!isRoot && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    // TODO
    if (!(key in vm)) {
      proxy(vm, `_props`, key)
    }
  }
  toggleObserving(true)
}

/**
 * 初始化data，将data代理到实例上，并添加监听（get依赖收集，set更新）
 * @param {*} vm 
 */
function initData (vm: Component) {
  let data = vm.$options.data
  // data如果是fn，执行得到结果
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}
  // 得到data必须是个对象
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  // while自减不会有性能问题吗
  while (i--) {
    const key = keys[i]
    // 检查是否跟 method 或 prop 重名
    if (process.env.NODE_ENV !== 'production') {
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    // 检擦不以$ _开头
    } else if (!isReserved(key)) {
      // 将_data代理到vm上
      proxy(vm, `_data`, key)
    }
  }
  // observe data
  // 给data的每个属性添加监听（get依赖收集，set更新）
  observe(data, true /* asRootData */)
}

export function getData (data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  pushTarget()
  try {
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget()
  }
}

const computedWatcherOptions = { lazy: true }

function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  // Object.create(null) 与 {} 的区别 TODO
  // watchers
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  const isSSR = isServerRendering()

  for (const key in computed) {
    const userDef = computed[key]
    // computed定义为对象形式，必须有get
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    if (!isSSR) {
      // create internal watcher for the computed property.
      // 创建该监听属性的lazy watcher
      // lazy: watcher不会立马执行getter，在需要时才执行，并收集此依赖
      // 即computed属性在调用时，才收集
      // TODO 应该大部分watcher都是如此，有需要立马执行的getter?
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    // 此计算属性名名称未被占用
    if (!(key in vm)) {
      // 定义到vm上
      defineComputed(vm, key, userDef)
    // 提示名称冲突
    } else if (process.env.NODE_ENV !== 'production') {
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}

export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  const shouldCache = !isServerRendering()
  // 重建computed的get
  if (typeof userDef === 'function') {// computed 函数写法转对象
    // 重建get，此get执行时，会让data收集watcher
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : createGetterInvoker(userDef)
    sharedPropertyDefinition.set = noop
  } else {
    // TODO userDef.cache ? 似乎这个可以配置
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : createGetterInvoker(userDef.get)
      : noop
    sharedPropertyDefinition.set = userDef.set || noop
  }
  // 不设置set报错
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

// 创建get
function createComputedGetter (key) {
  // computed计算结果过程中(watcher.get)，将计算属性的watcer放到Dep.target全局
  // 那么计算中使用到的data等的依赖收集器就会收集到这个计算属性
  // data等更新时，进行重新计算
  return function computedGetter () {
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      // 首次会执行
      // computed都是lazy watcher ，get不会立即执行，这里手动执行，因为服务端渲染时不需要执行
      if (watcher.dirty) {
        watcher.evaluate()
      }
      // TODO evaluate()之后当前watcher已被推出，这里的target哪来的？
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }
  }
}

function createGetterInvoker(fn) {
  return function computedGetter () {
    return fn.call(this, this)
  }
}

/**
 * 将methods配置的方法复制到vm上，同时绑定作用域
 * @param {*} vm 
 * @param {*} methods 
 */
function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props
  for (const key in methods) {
    // 开发模式进行检查
    if (process.env.NODE_ENV !== 'production') {
      // 检查是否为方法
      if (typeof methods[key] !== 'function') {
        warn(
          `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      // 检查方法是否已定义
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      // 检查字符串是否以$ _开头
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    // 方法直接赋值给vm，并绑定作用域
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
  }
}

function initWatch (vm: Component, watch: Object) {
  for (const key in watch) {
    const handler = watch[key]
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

function createWatcher (
  vm: Component,
  expOrFn: string | Function,
  handler: any,
  options?: Object
) {
  // 配置为对象时参数处理
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  // 为字符串时（表示函数名）处理
  if (typeof handler === 'string') {
    handler = vm[handler]
  }
  return vm.$watch(expOrFn, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function () {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    // handler可能是个函数数组，递归
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    // TODO user 配置的作用 ? 
    options.user = true
    // watcher
    // 创建watcher时会调用vm上对应的属性
    // 这个过程中watcher被推入到Dep.target上
    // 那么过程中使用data等时就会收集到此watcher
    // 然后执行watch函数，后续data变化会主动执行watch函数
    const watcher = new Watcher(vm, expOrFn, cb, options)
    // immediate 则立即执行函数
    if (options.immediate) {
      try {
        cb.call(vm, watcher.value)
      } catch (error) {
        handleError(error, vm, `callback for immediate watcher "${watcher.expression}"`)
      }
    }
    // 选项watcher的方法
    return function unwatchFn () {
      watcher.teardown()
    }
  }
}
