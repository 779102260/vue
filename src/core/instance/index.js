/**
 * Vue构造器部分
 */


// 初始化方法 混入
import { initMixin } from './init'
// state 混入
import { stateMixin } from './state'
// 渲染方法 混入
import { renderMixin } from './render'
// 事件 混入
import { eventsMixin } from './events'
// 生命周期 混入
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

function Vue (options) {
  // 不让直接调用 Vue()
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  // ** 实例化时调用这个方法
  this._init(options)
}

// 之所以用多个方法在Vue原型上加方法，是为了拆分Vue这个大类，模块清晰，简单明了。
initMixin(Vue)
stateMixin(Vue)
eventsMixin(Vue)
lifecycleMixin(Vue)
renderMixin(Vue)

export default Vue
