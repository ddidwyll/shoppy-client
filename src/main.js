import store from './store.js'
import Index from './modules/index.html';
import Menu from './modules/menu.html';
import './styles/paper.scss'
import './styles/style.scss'

document.addEventListener('DOMContentLoaded', main)

function main() {
  window.store = store
  window.scroller = function(el) {
    if (!!el && el.scrollHeight > el.offsetHeight) {
      let dir = el.scrollTop > 100 ? 'top sm-12 md-8 lg-9 col' : 'sm-12 md-8 lg-9 col'
      dir += el.scrollTop < el.scrollHeight - el.clientHeight ? ' bot sm-12 md-8 lg-9 col' : 'sm-12 md-8 lg-9 col'
      el.parentNode.classList = dir
    } else {
      el.parentNode.classList = 'sm-12 md-8 lg-9 col'
    }
  }
  window.scrolling = function(id, dir) {
    var tag = document.getElementById(id)
    tag.scrollTop = dir === 'bot' ? tag.scrollHeight : 0
  }
  window.app = new Index({target: document.getElementById('app'), store, data: {y: (new Date).getFullYear().toString()}})
  new Menu({target: document.getElementById('nav_small'), store})
  new Menu({target: document.getElementById('nav'), store})
  setInterval(function() {
    store.init()
  }, 60000)
}
