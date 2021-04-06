/* @flow */

import config from '../config'
import VNode, { createEmptyVNode } from './vnode'
import { createComponent } from './create-component'
import { traverse } from '../observer/traverse'

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  isObject,
  isPrimitive,
  resolveAsset
} from '../util/index'

import {
  normalizeChildren,
  simpleNormalizeChildren
} from './helpers/index'

const SIMPLE_NORMALIZE = 1
const ALWAYS_NORMALIZE = 2

// wrapper function for providing a more flexible interface
// without getting yelled at by flow
/**
 * 调用_createElement创建vnode，此函数让参数配置更灵活，可以省略data参数
 * createElement('div', {class: 'test'}, '测试')
 * createElement('div',  '测试')
 * @param {*} context 上下文
 * @param {*} tag 标签名
 * @param {*} data 数据对象
 * @param {*} children 子节点
 * @param {*} normalizationType 子节点 节点类型
 * @param {*} alwaysNormalize  
 */
export function createElement (
  context: Component, // TODO 可能由bind传入
  tag: any,
  data: any,
  children: any,
  normalizationType: any, // TODO
  alwaysNormalize: boolean // TODO
): VNode | Array<VNode> {
  // data是数组或基本类型，指的是children，此时移动参数
  if (Array.isArray(data) || isPrimitive(data)) {
    normalizationType = children
    children = data
    data = undefined
  }
  // TODO
  if (isTrue(alwaysNormalize)) {
    normalizationType = ALWAYS_NORMALIZE
  }
  return _createElement(context, tag, data, children, normalizationType)
}

/**
 * 
 * @param {*} context 上下文
 * @param {*} tag 标签名
 * @param {*} data 数据对象
 * @param {*} children 子节点
 * @param {*} normalizationType 子节点 节点类型
 */
export function _createElement (
  context: Component,
  tag?: string | Class<Component> | Function | Object,
  data?: VNodeData,
  children?: any,
  normalizationType?: number
): VNode | Array<VNode> {
  if (isDef(data) && isDef((data: any).__ob__)) {
    // 数据对象不可以是 undefined null 或 被监听的对象
    process.env.NODE_ENV !== 'production' && warn(
      `Avoid using observed data object as vnode data: ${JSON.stringify(data)}\n` +
      'Always create fresh vnode data objects in each render!',
      context
    )
    return createEmptyVNode()
  }
  // object syntax in v-bind
  // data.is可以指定 tagName（TODO 动态组件 ）
  if (isDef(data) && isDef(data.is)) {
    tag = data.is
  }
  if (!tag) {
    // in case of component :is set to falsy value
    return createEmptyVNode()
  }
  // warn against non-primitive key
  // data.key 必须是基本类型
  if (process.env.NODE_ENV !== 'production' &&
    isDef(data) && isDef(data.key) && !isPrimitive(data.key)
  ) {
    if (!__WEEX__ || !('@binding' in data.key)) {
      warn(
        'Avoid using non-primitive value as key, ' +
        'use string/number value instead.',
        context
      )
    }
  }
  // support single function children as default scoped slot
  // children 是函数时作为default 作用域插槽
  if (Array.isArray(children) &&
    typeof children[0] === 'function'
  ) {
    data = data || {}
    data.scopedSlots = { default: children[0] }
    children.length = 0 // TODO 比 children = [] 更好?
  }
  // children 格式化处理（多种写法统一转为vnode数组）
  if (normalizationType === ALWAYS_NORMALIZE) {
    // 正常格式化
    children = normalizeChildren(children)
  } else if (normalizationType === SIMPLE_NORMALIZE) {
    // 简单格式化 TODO 这种请求什么时候出现 
    children = simpleNormalizeChildren(children)
  }
  let vnode, ns
  // 创建标签vnode
  // tag 三种写法 String | Object | Function，为string是才是标签名，后面2个表示组件配置项和组件创建函数
  if (typeof tag === 'string') {
    let Ctor
    // TODO 啥玩意
    // config 在抹平层 src\platforms\web\compiler\options.js
    ns = (context.$vnode && context.$vnode.ns) || config.getTagNamespace(tag)
    // html标签
    if (config.isReservedTag(tag)) {
      // platform built-in elements
      // html标签不可使用nativeOn（只能用于组件）
      if (process.env.NODE_ENV !== 'production' && isDef(data) && isDef(data.nativeOn)) {
        warn(
          `The .native modifier for v-on is only valid on components but it was used on <${tag}>.`,
          context
        )
      }
      // 标签vnode
      vnode = new VNode(
        // parsePlatformTagName 可能用于映射不同平台的标签名
        config.parsePlatformTagName(tag), data, children,
        undefined, undefined, context
      )
      // 创建组件vnode (先去查找组件)
    } else if ((!data || !data.pre) && isDef(Ctor = resolveAsset(context.$options, 'components', tag))) {
      // component TODO 创建组件先跳过
      vnode = createComponent(Ctor, data, context, children, tag)
    } else {
      // unknown or unlisted namespaced elements
      // check at runtime because it may get assigned a namespace when its
      // parent normalizes children
      vnode = new VNode(
        tag, data, children,
        undefined, undefined, context
      )
    }
  } else {
    // direct component options / constructor
    vnode = createComponent(tag, data, context, children)
  }
  // TODO 
  if (Array.isArray(vnode)) {
    return vnode
  } else if (isDef(vnode)) {
    if (isDef(ns)) applyNS(vnode, ns)
    if (isDef(data)) registerDeepBindings(data)
    return vnode
  } else {
    return createEmptyVNode()
  }
}

function applyNS (vnode, ns, force) {
  vnode.ns = ns
  if (vnode.tag === 'foreignObject') {
    // use default namespace inside foreignObject
    ns = undefined
    force = true
  }
  if (isDef(vnode.children)) {
    for (let i = 0, l = vnode.children.length; i < l; i++) {
      const child = vnode.children[i]
      if (isDef(child.tag) && (
        isUndef(child.ns) || (isTrue(force) && child.tag !== 'svg'))) {
        applyNS(child, ns, force)
      }
    }
  }
}

// ref #5318
// necessary to ensure parent re-render when deep bindings like :style and
// :class are used on slot nodes
function registerDeepBindings (data) {
  if (isObject(data.style)) {
    traverse(data.style)
  }
  if (isObject(data.class)) {
    traverse(data.class)
  }
}
