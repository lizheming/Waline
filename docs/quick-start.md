# 快速开始

如果你想在某个网页或者文章页中使用 Waline，请参照以下步骤配置

## 获取APP ID 和 APP Key

请先[登录](https://leancloud.cn/dashboard/login.html#/signin)或[注册](https://leancloud.cn/dashboard/login.html#/signup) `LeanCloud`, 进入[控制台](https://leancloud.cn/dashboard/applist.html#/apps)后点击左下角[创建应用](https://leancloud.cn/dashboard/applist.html#/newapp)：

![](https://i.loli.net/2019/06/21/5d0c995c86fac81746.jpg)

应用创建好以后，进入刚刚创建的应用，选择左下角的`设置`>`应用Key`，然后就能看到你的`APP ID`和`APP Key`了：

![](https://i.loli.net/2019/06/21/5d0c997a60baa24436.jpg)

## Vercel 部署

[ ![](https://vercel.com/button) ](https://vercel.com/import/project?template=https://github.com/lizheming/waline/tree/master/example)

点击上方按钮，跳转至 Vercel 进行快速部署。未登录的话需要登录，这里选 Github 登录即可。登录后会让你输入 Vercel 项目名称。

![](https://p2.ssl.qhimg.com/t018cd2a91a8896a555.png)

输入名称后点击 <kbd>Continue</kbd> 进入下一步，输入 Github 仓库名称。Vercel 会基于 waline 模板帮助你新建并初始化该仓库。

![](https://p4.ssl.qhimg.com/t01bb30e74f85ddf5b3.png)

仓库初始化完毕后开始准备部署到 Vercel。这里需要在 Environment Variables 初配置 `LEAN_ID` 和 `LEAN_KEY` 两个环境变量。它们的值分别对应上一步在 LeanCloud 中获得的 `APP ID` 和 `APP_KEY`。

![](https://p5.ssl.qhimg.com/t019aec05e3e5fea5cc.png)

点击 <kbd>Deploy</kbd> 就会开始进行部署了。稍等片刻，就会看到满屏的烟花庆祝你部署成功了。点击 <kbd>Visit</kbd> 会跳转到部署好的网站地址上，该地址即为之后需要填入的 `serverURL` 地址。

![](https://p0.ssl.qhimg.com/t0142b58c2e8f886b28.png)

## HTML 片段

修改初始化对象中的 `serverURL` 的值为上面刚刚获取到的二级域名即可(其他可以默认)。

```html
<head>
  ..
  <script src='//unpkg.com/@waline/client/dist/Waline.min.js'></script>
  ...
</head>
<body>
  ...
  <div id="waline"></div>
  <script>
    new Waline({
      el: '#waline',
      path: location.pathname,
      serverURL: 'https://your-domain.vercel.app'
    });
  </script>
</body>
```


## 配置

修改初始化对象中的 `serverURL` 的值为上面刚刚获取到的二级域名即可(其他可以默认)。

```js
new Waline({
  el: '#waline',
  path: location.pathname
});
```


## NPM

Waline 已发布到[npm](https://www.npmjs.com/package/@waline/client)，可以直接用命令安装：

```bash
# Install waline
npm install @waline/client --save-dev
```

```js
// Use import
import Waline from '@waline/client';
// or Use require
const Waline = require('@waline/client');

new Waline({
  el:'#waline',
  // other config
})
```

## 评论数据管理

目前 Waline 还未实现评论管理功能，可以先自行登录 LeanCloud 进行管理。

具体步骤：<kbd>登录</kbd> > <kbd>选择你创建的应用</kbd> > <kbd>存储</kbd> > 选择 Class <kbd>Comment</kbd> 然后就可以尽情的发挥你的权利啦(～￣▽￣)～

> 当然，你也可以配合 [@DesertsP](https://github.com/DesertsP) 开发的 [Valine-Admin](https://github.com/DesertsP/Valine-Admin) 进行`评论数据管理`。

更多信息请查看[配置项](/configuration.html)。
