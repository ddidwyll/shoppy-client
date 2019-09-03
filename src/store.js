import {Store} from 'svelte/store.js'
import localforage from 'localforage'

const initial = {
  page: '', orders: {}, products: {}, users: {}, basket: {}, mtimes: {}, id: '', pass: ''
}
const url = {
  api: location.protocol + '//' + location.hostname + ':' + location.port + '/api',
  pub: location.protocol + '//' + location.hostname + ':' + location.port + '/pub'
}
const headers = () => ({
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'Authorization': 'Bearer ' + localStorage.getItem('token')
})

class CoolStore extends Store {
  async init() {
    if (!localStorage.getItem('token') || localStorage.getItem('expire') <= Date.now() / 1000) {
      await this.logout()
      return document.getElementById('login').checked = true
    }
    this.jump(localStorage.getItem('page') || '')
    await this.sync('products')
    await this.sync('users')
    await this.sync('orders')
  }
  async sync(key) {
    if (!key || key === 'pass') return
    const {mtimes} = this.get(), modState = mtimes[key], value = {}
    let modServ = (await this.GET('mtimes', 'pub'))[key].toString()
    let modStor = await localforage.getItem('mod' + key)
    if (!modServ && !modStor) this.alert('Disconnected', 'Check your connection with server')
    if (!!modServ && (modStor !== modServ)) {
      value[key] = await this.GET(key)
      if (!!value[key].upd) delete value[key].upd
      await localforage.setItem(key, value[key])
      modStor = await localforage.setItem('mod' + key, modServ)
    }
    if (!!modStor && (modState !== modStor)) {
      value[key] = await localforage.getItem(key)
      this.set(value)
      mtimes[key] = modStor
      this.set({mtimes: mtimes})
    }
  }
  async GET(key) {
    const dest = (key === 'products' || key === 'mtimes') ? 'pub' : 'api'
    return await fetch(url[dest] + '/' + key, {headers: headers()}).then((r) => r.ok ? r.json() : {})
  }
  async DEL() {
    let ok = false
    const {delType, delId, delYes} = this.get()
    if (delYes.toLowerCase() !== 'yes') return
    return await fetch(url['api'] + '/' + delType + '/' + delId,
      {method: 'DELETE', headers: headers()}).then((r) => {ok = r.ok; return r.json()})
      .then((r) => this.sync(delType).then(() => {
        document.getElementById('confirm').checked = false
        this.set({delType: '', delId: '', delYes: ''})
        this.alert(ok ? 'Success' : 'Error', r.message)
      }))
  }
  async PUST(key, method = 'POST', data) {
    let ok = false
    const t = this
    return fetch(url.api + '/' + key, {
      method: method, body: JSON.stringify(data), headers: headers()
    }).then((r) => { ok = r.ok; return r.json() }).then((r) => {
      t.sync(key); t.alert(ok ? 'Success' : 'Error', r.message)
    })
  }
  async release() {
    this.init()
    const splash = document.getElementById('splash')
    splash.className = 'end'
    setTimeout(() => { splash.className = 'hidden' }, 1500)
  }
  take() {
    document.getElementById('splash').className = ''
  }
  alert(title = '', text = '') {
    const modal = document.getElementById('modal')
    document.getElementById('modal_text').textContent = text
    document.getElementById('modal_title').textContent = title
    modal.checked = true
    setTimeout(() => { modal.checked = false }, 3500)
  }
  jump(where) {
    this.set({page: where})
    localStorage.setItem('page', where)
    document.getElementById('collapsible-top').checked = false
  }
  async addOrder() {
    const {basket, products} = this.get(), order = {'vals': Object.assign({}, basket)}, t = this
    if (!Object.keys(basket).length) return
    order.id = (Math.floor(Date.now() / 1000)).toString()
    order.who = localStorage.getItem('id') || 'unknow'
    Object.keys(basket).forEach((key) => {
      const product = Object.assign({}, products[key])
      if (!!product) {
        const d = new Date, y = d.getFullYear().toString(), m = d.getMonth().toString()
        product.balance = Math.round((product.balance - basket[key].qt) * 1000) / 1000
        product.stats = product.stats || {};
        product.stats[y] = product.stats[y] || {};
        product.stats[y][m] = product.stats[y][m] || 0
        product.stats[y][m] = Math.round((product.stats[y][m] + basket[key].qt) * 1000) / 1000
        t.PUST('products', 'PUT', product)
      }
    })
    this.set({basket: {}})
    return this.PUST('orders', 'POST', order)
  }
  addProduct(name) {
    const {products, basket} = this.get()
    if (!products[name]) return
    basket[name] = {pr: products[name].price}
    this.set({basket})
  }
  delProduct(name) {
    const basket = this.get().basket
    delete basket[name]
    this.set({basket})
  }
  countProduct(name, quantity) {
    const basket = this.get().basket
    basket[name].qt = Number(quantity)
    this.set({basket})
  }
  login(e = {which: 13}) {
    const {id, pass} = this.get()
    if (!id || !pass || !(e.which === 13 || e.keyCode === 13)) return
    let ok = false
    fetch(url.pub + '/login', {
      method: 'POST',
      body: JSON.stringify({id, pass}),
      headers: {'Content-Type': 'application/json'}
    }).then((r) => {
      if (r.ok) ok = true
      return r.json()
    }).then((r) => {
      document.getElementById('login_errors').textContent = r.message
      if (ok) {
        this.set({id: r.id, pass: ''})
        Object.keys(r).forEach((key) => localStorage.setItem(key, r[key]))
        document.getElementById('login').checked = false
        this.init()
      }
    }).catch((err) => document.getElementById('login_errors').textContent = err)
  }
  async logout() {
    await localforage.clear()
    localStorage.clear()
    this.set({orders: {}, products: {}, users: {}, basket: {}, mtimes: {}, userName: ''})
    this.jump('')
    document.getElementById('login').checked = true
  }
  edit(type, id = '') {
    document.getElementById(type).checked = true
    const def = this.get().defaults[type], current = !!id ? this.get()[type][id] || def : def, role = this.get().me.role
    if (type === 'users' && role !== 5) current.role = role
    this.set({current: Object.assign({}, current)})
  }
  password(id) {
    document.getElementById('pass').checked = true
    const current = {id, pass: ''}
    this.set({current: Object.assign({}, current)})
  }
  image(id) {
    document.getElementById('image').checked = true
    this.set({current: Object.assign({}, {id})})
  }
  imageUpload(event) {
    const formData = new FormData()
    formData.append('file', event.target.files[0])
    formData.append('name', this.get().current.id)
    const options = {
      method: 'POST',
      headers: headers(),
      body: formData
    }
    delete options.headers['Content-Type']
    let ok = false
    fetch(url.api + '/upload', options).then((r) => { ok = r.ok; return r.json() })
    .then((r) => {
      if (ok) document.getElementById('image').checked = false; location.reload()
      this.alert(ok ? 'Success' : 'Error', r.message)
    }).catch(error => this.alert('Error', error))
  }
  balance(id) {
    const current = this.get().products[id]
    if (!current) return
    current.add = null
    document.getElementById('balance').checked = true
    this.set({current: Object.assign({}, current)})
  }
  async save(type) {
    const {current} = this.get(), all = this.get()[type], exist = all.hasOwnProperty(current.id)
    await this.PUST(type, exist ? 'PUT' : 'POST', current)
    this.set({current: Object.assign({}, {})})
    document.getElementById(type).checked = false
  }
  async savePass() {
    await this.PUST('pass', 'PUT', this.get().current)
    this.set({current: Object.assign({}, {})})
    document.getElementById('pass').checked = false
  }
  async saveBalance() {
    const current = this.get().current
    current.balance = Math.round((current.balance + current.add) * 1000) / 1000
    await this.PUST('products', 'PUT', current)
    this.set({current: Object.assign({}, {})})
    document.getElementById('balance').checked = false
  }
  confirm(type, id) {
    this.set({delType: type, delId: id})
    document.getElementById('confirm').checked = true
  }
}

const store = new CoolStore({
  monthes: {'1':'Jan','2':'Feb','3':'Mar','4':'Apr','5':'May','6':'Jun','7':'Jul','8':'Aug','9':'Sep','10':'Oct','11':'Nov','12':'Dec'},
  defaults: {
    users: {name:'', id:'', phone: '', role: 3},
    products: {id:'', full:'', price: null, unit: '', balance: null, stats: {}, type: ''}
  },
  orders: {},
  products: {},
  users: {},
  basket: {},
  mtimes: {},
  page: '',
  id: '',
  pass: '',
  current: {},
  delType: '',
  delId: '',
  delYes: ''
})

store.compute('summary', ['basket'], (basket) => {
    return Math.round(Object.values(basket).reduce((s, p) => p.qt * p.pr + s, 0) * 100) / 100 || 0
  }
)
store.compute('me', ['users', 'defaults'], (users, defaults) => users[localStorage.getItem('id')] || defaults.users)
store.compute('grouped', ['products'], (products) => {
    const result = {}
    Object.keys(products).forEach((key) => {
      const product = products[key]
      const type = product.type || 'other'
      if (!!type && !result[type]) result[type] = []
      result[type].push(product)
    })
    return result
  }
)

export default store
