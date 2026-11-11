import { createRouter } from './index'

function router() {
  const r = createRouter()
  r.add('GET', '/users', 'listUsers')
  r.add('GET', '/users/:id', 'getUser')
  r.add('DELETE', '/users/:id', 'deleteUser')
  r.add('GET', '/users/:id/orders/:orderId', 'getOrder')
  r.add('GET', '/files/*', 'serveFile')
  return r
}

export function testMatchesStaticRoutes() {
  assertEqual(router().match('GET', '/users'), { handler: 'listUsers', params: {} })
}

export function testCapturesParams() {
  assertEqual(router().match('GET', '/users/42/orders/a%20b'), { handler: 'getOrder', params: { id: '42', orderId: 'a b' } })
}

export function testIgnoresQueryAndTrailingSlash() {
  assertEqual(router().match('GET', '/users/7/?expand=orders'), { handler: 'getUser', params: { id: '7' } })
}

export function testWildcardCapturesTheRest() {
  assertEqual(router().match('GET', '/files/img/logo.png'), { handler: 'serveFile', params: { '*': 'img/logo.png' } })
}

export function testMethodNotAllowed() {
  assertEqual(router().match('PUT', '/users/7'), { status: 405, allow: ['GET', 'DELETE'] })
}

export function testNotFound() {
  assertEqual(router().match('GET', '/users/7/profile'), { status: 404 })
  assertEqual(router().match('GET', '/users//orders/1'), { status: 404 })
}
