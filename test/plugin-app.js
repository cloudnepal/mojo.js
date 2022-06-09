import mojo from '../lib/core.js';
import t from 'tap';

t.test('Plugin app', async t => {
  const app = mojo();

  if (app.mode === 'development') app.log.level = 'debug';

  app.plugin(mixedPlugin);

  app.get('/tag_helpers', ctx => ctx.render({inline: tagHelperPlugin}));

  app.get('/helper', ctx => ctx.render({text: ctx.testHelper('test')}));

  app.get('/getter/setter', ctx => {
    const before = ctx.testProp;
    ctx.testProp = 'also works';
    const after = ctx.testProp;
    ctx.render({text: `before: ${before}, after: ${after}`});
  });

  app.get('/method', ctx => ctx.render({text: ctx.testMethod('test')}));

  app
    .websocket('/websocket/mixed')
    .to(ctx => {
      ctx.on('connection', ws => {
        const before = ctx.testProp;
        ctx.testProp = 'works too';
        const after = ctx.testProp;
        const also = ctx.testHelper('test');
        ws.send(`before: ${before}, after: ${after}, also: ${also}`);
        ws.close();
      });
    })
    .name('mix');

  const ua = await app.newTestUserAgent({tap: t});

  await t.test('Tag helpers', async () => {
    const baseURL = ua.server.urls[0].toString();
    const publicPath = app.static.prefix.substring(1) + '/';
    (await ua.getOk('/tag_helpers')).statusIs(200).bodyIs(tagHelperPluginResult(baseURL, publicPath));
  });

  await t.test('Helper', async () => {
    (await ua.getOk('/helper')).statusIs(200).bodyIs('works');
  });

  await t.test('Decorate with getter and setter', async () => {
    (await ua.getOk('/getter/setter')).statusIs(200).bodyIs('before: works, after: also works');
  });

  await t.test('Decorate with method', async () => {
    (await ua.getOk('/method')).statusIs(200).bodyIs('also works');
  });

  await t.test('WebSocket', async t => {
    await ua.websocketOk('/websocket/mixed');
    t.equal(await ua.messageOk(), 'before: also works, after: works too, also: works too');
    await ua.closedOk(1005);
  });

  await ua.stop();
});

const tagHelperPlugin = `
Route: <%= ctx.currentRoute() %>
Favicon: <%= ctx.mojoFaviconTag() %>
Relative image1: <%= ctx.imageTag('/foo/bar.png') %>
Relative image2: <%= ctx.imageTag('/foo/bar.png', {alt: 'Bar'}) %>
Relative script: <%= ctx.scriptTag('/foo/bar.js') %>
Relative style: <%= ctx.styleTag('/foo/bar.css') %>
Absolute image: <%= ctx.imageTag('https://mojojs.org/public/foo/bar.png') %>
Absolute script: <%= ctx.scriptTag('https://mojojs.org/public/foo/bar.js') %>
Absolute style: <%= ctx.styleTag('https://mojojs.org/public/foo/bar.css') %>
Link1: <%= ctx.linkTo('getter_setter', {class: 'foo'}, 'Getter & Setter') %>
Link2: <%= ctx.linkTo('mix', {}, 'WebSocket link') %>
Tag1: <%= ctx.tag('div', 'Hello Mojo!') %>
Tag2: <%== ctx.tag('div', {class: 'test'}, 'Hello Mojo!') %>
`;

function tagHelperPluginResult(baseURL, publicPath) {
  const wsURL = baseURL.replace('http', 'ws');
  return `
Route: tag_helpers
Favicon: <link rel="icon" href="/${publicPath}mojo/favicon.ico">
Relative image1: <img src="/${publicPath}foo/bar.png">
Relative image2: <img src="/${publicPath}foo/bar.png" alt="Bar">
Relative script: <script src="/${publicPath}foo/bar.js"></script>
Relative style: <link rel="stylesheet" href="/${publicPath}foo/bar.css">
Absolute image: <img src="https://mojojs.org/public/foo/bar.png">
Absolute script: <script src="https://mojojs.org/public/foo/bar.js"></script>
Absolute style: <link rel="stylesheet" href="https://mojojs.org/public/foo/bar.css">
Link1: <a href="/getter/setter" class="foo">Getter &amp; Setter</a>
Link2: <a href="${wsURL}websocket/mixed">WebSocket link</a>
Tag1: <div>Hello Mojo!</div>
Tag2: <div class="test">Hello Mojo!</div>
`;
}

function mixedPlugin(app) {
  app.config.test = 'works';

  app.addHelper('testHelper', (ctx, name) => ctx.config[name]);

  app.decorateContext('testMethod', function (name) {
    return this.config[name];
  });

  app.decorateContext('testProp', {
    get: function () {
      return this.config.test;
    },
    set: function (value) {
      this.config.test = value;
    }
  });
}
