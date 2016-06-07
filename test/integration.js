var tape = require('tape')
var Blobs = require('../inject')
var pull = require('pull-stream')
var bitflipper = require('pull-bitflipper')
var assert = require('assert')

var u = require('./util')
var Fake = u.fake
var hash = u.hash

module.exports = function (createBlobStore, createAsync) {


  function log (name) {
    if(LOGGING)
      return pull.through(function (e) {
        console.log(name, e)
      })
    else
      return pull.through()
  }

  tape('want - has', function (t) {
    createAsync(function (async) {
      var alice = Blobs(createBlobStore('wh-alice', async))
      var bob   = Blobs(createBlobStore('wh-bob', async))
      var blob = Fake('foobar', 64)
      var h = hash(blob)

      u.peers('alice', alice, 'bob', bob)//, async)

      alice.want(h, function (err, has) {
        if(err) throw err
        console.log('ALICE has', h)
        alice.has(h, function (err, has) {
          if(err) throw err
          assert.ok(has)
          async.done()
        })
      })

      pull(pull.once(blob), bob.add())
    }, function (err) {
      if(err) throw err
      t.end()
    })
  })
  return
  tape('want - has 2', function (t) {
    createAsync(function (async) {
      var alice = Blobs(createBlobStore('wh2-alice', async))
      var bob   = Blobs(createBlobStore('wh2-bob', async))
      var blob = Fake('foobar', 64)
      var h = hash(blob)

      u.peers('bob', bob, 'alice', alice)
      pull(pull.once(blob), bob.add())

      alice.want(h, function (err, has) {
        if(err) throw err
        alice.has(h, function (err, has) {
          if(err) throw err
          assert.ok(has)
          async.done()
        })
      })
    }, function (err) {
      if(err) throw err
      t.end()
    })
  })

  tape('want - want -has', function (t) {
    createAsync(function (async) {
      var alice = Blobs(createBlobStore('wwh-alice', async))
      var bob   = Blobs(createBlobStore('wwh-bob', async))
      var carol = Blobs(createBlobStore('wwh-carol', async))

      var blob = Fake('baz', 64)
      var h = hash(blob)

      u.peers('alice', alice, 'bob', bob)
      u.peers('bob', bob, 'carol', carol)

      alice.want(h, function (err, has) {
        if(err) throw err
        alice.has(h, function (err, has) {
          if(err) throw err
          assert.ok(has)
          async.done()
        })
      })

      pull(pull.once(blob), carol.add())
    }, function (err) {
      if(err) throw err
      t.end()
    })
  })


  tape('peers want what you have', function (t) {
    createAsync(function (async) {
      if(Array.isArray(process._events['exit']))
        console.log(process._events['exit'].reverse())
      var alice = Blobs(createBlobStore('peer-alice', async), 'alice')
      var bob   = Blobs(createBlobStore('peer-bob', async), 'bob')
      var carol = Blobs(createBlobStore('peer-carol', async), 'carol')

      var blob = Fake('baz', 64)
      var h = hash(blob)

      u.peers('alice', alice, 'bob', bob)
      u.peers('bob', bob, 'carol', carol)

      pull(
        carol.changes(),
        pull.drain(function (_h) {
          assert.equal(_h, h)
          async.done()
        })
      )

      alice.want(h, function () {})
      pull(pull.once(blob), alice.add())
    }, function (err) {
      if(err) throw err
      t.end()
    })
  })


  tape('triangle', function (t) {
    createAsync(function (async) {
      var n = 0
      var alice = Blobs(createBlobStore('triangle-alice', async), 'alice')
      var bob   = Blobs(createBlobStore('triangle-bob', async), 'bob')
      var carol = Blobs(createBlobStore('triangle-carol', async), 'carol')

      var blob = Fake('baz', 64)
      var h = hash(blob)

      u.peers('alice', alice, 'bob', bob)
      u.peers('bob', bob, 'carol', carol)

      pull(
        bob.changes(),
        pull.drain(function (_h) {
          assert.equal(_h, h)
          async.done()
        })
      )

      pull(pull.once(blob), alice.add())
      pull(pull.once(blob), carol.add())

      bob.want(h, function () {})
    }, function (err) {
      if(err) throw err
      t.end()
    })
  })

  tape('corrupt', function (t) {
    createAsync(function (async) {
      var n = 0
      var alice = Blobs(createBlobStore('corrupt-alice', async), 'alice')
      var bob   = Blobs(createBlobStore('corrupt-bob', async), 'bob')
      var carol = Blobs(createBlobStore('corrupt-carol', async), 'carol')

      //everything that comes from bob is corrupt
      var get = alice.get
      alice.get = function (id) {
        return pull(get(id), bitflipper(1))
      }

      var blob = Fake('baz', 64)
      var h = hash(blob)

      u.peers('alice', alice, 'bob', bob)
      u.peers('bob', bob, 'carol', carol)

      pull(
        bob.changes(),
        pull.drain(function (_h) {
          console.log('HAS', _h)
          assert.equal(_h, h)
          async.done()
        })
      )

      bob.want(h, function () {})
      pull(pull.once(blob), alice.add())
      pull(pull.once(blob), carol.add())
    }, function (err) {
      if(err) throw err
      t.end()
    })
  })

  tape('cycle', function (t) {
    createAsync(function (async) {
      var n = 0
      var alice = Blobs(createBlobStore('cycle-alice', async), 'alice')
      var bob   = Blobs(createBlobStore('cycle-bob', async), 'bob')
      var carol = Blobs(createBlobStore('cycle-carol', async), 'carol')
      var dan   = Blobs(createBlobStore('cycle-dan', async), 'dan')
      u.peers('alice', alice, 'bob', bob)
      u.peers('bob', bob, 'carol', carol)
      u.peers('carol', carol, 'dan', dan)
      u.peers('dan', dan, 'alice', alice)

      var blob = Fake('gurg', 64)
      var h = hash(blob)
      alice.want(h, function (err, has) {
        async.done()
      })

      pull(pull.once(blob), dan.add(h))
    }, function (err) {
      if(err) throw err
      t.end()
    })

  })
}

if(!module.parent)
  module.exports(require('./mock'), require('./util').sync)



