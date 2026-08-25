import Vue from 'vue'
import App from './App'
import ElementUI from 'element-ui';
import locale from 'element-ui/lib/locale/lang/en'
Vue.use(ElementUI, { locale });
import Contextmenu from "./component/Contextmenu"
Vue.use(Contextmenu);
import UmyTable from 'umy-table'
import umyLocale from 'umy-table/lib/locale/lang/en'
import 'umy-table/lib/theme-chalk/index.css';
import '@/../public/theme/auto.css'
import '@/../public/theme/umyui.css'
import './view.css'
import './icon/iconfont.css'
Vue.use(UmyTable, { locale: umyLocale });

Vue.config.productionTip = false

new Vue({
  el: '#app',
  components: { App },
  template: '<App/>'
})
