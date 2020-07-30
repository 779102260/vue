/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

export function initMixin (Vue: Class<Component>) {
  /**
   * 初始化实例
   * @param {object} options new Vue(options) 时传入的配置项
   */
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this
    // uid 每次实例有唯一标记_uid
    vm._uid = uid++

    // =======part1. 新能分析 TODO=========================================================================
    let startTag, endTag
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      /* 用于非生产模式时浏览器进行性能分析，在全局配置上开启*/
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }
    // ==============================================================================================================================

    vm._isVue = true // _isVue标记：用于避免被监听 TODO

    // =====part2. 合并options===========================================================================
    if (options && options._isComponent) { // TODO
      // 内部组件处理优化，因为mergeOptions似乎有性能问题 TODO
      initInternalComponent(vm, options)
    } else {
      // mergeOptions
      vm.$options = mergeOptions(
        // 如果是通过Vue.extend创建的子类，那么检查options是否需要更新 TODO
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
    // ==============================================================================================================================

    // ===== part3. 一系列初始化 ===============================================================================
    // part3-1 代理：实例上添加个_renderProxy方法 TODO
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self TODO 这类操作有什么用
    vm._self = vm
    // part3-2 生命周期：添加一些相关属性
    initLifecycle(vm)
    // part3-3 事件 [TODO:]
    initEvents(vm)
    // part3-4 render: 添加$createElement等方法 [TODO:]
    initRender(vm)
    // 触发生命周期：beforeCreate [TODO:]
    callHook(vm, 'beforeCreate')
    // part3-5 inject: 拿到inject数据 [TODO:]
    initInjections(vm) // resolve injections before data/props
    // part3-6 state: props -> methods -> data -> computed -> watch [TODO:]
    initState(vm)
    // part3-7 provide：[TODO:]
    initProvide(vm) // resolve provide after data/props
    // 触发生命周期：created [TODO:]
    callHook(vm, 'created')
    // ===================================================================================================================


    /* istanbul ignore if */
    // 性能分析相关
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }
    
    // ===== part5 挂载 ===============================================================================
    // 如果有el挂载到目标
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
    // ===================================================================================================================
  }
}

export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

/**
 * 主要是解构获取构造器的options
 * 主要是其中对于如果构造器也是extend添加的时候应该怎么处理，以及它们的构造器如果有更新扩展，需要及时更新到下级
 * @param {*} Ctor Vue
 */
export function resolveConstructorOptions (Ctor: Class<Component>) {
  let options = Ctor.options // Vue.options TODO ?
  // 有super属性，说明Ctor是Vue.extend构建的子类 TODO 暂时不走这里
  if (Ctor.super) {
    // 递归父级组件，获取所有上级的全局options合集
    const superOptions = resolveConstructorOptions(Ctor.super)
    // extend组件的options
    const cachedSuperOptions = Ctor.superOptions
    // 如果父级组件被改变过，更新superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      // 检查是否有任何后期修改/附加选项，有则更新扩展的options
      const modifiedOptions = resolveModifiedOptions(Ctor)
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
