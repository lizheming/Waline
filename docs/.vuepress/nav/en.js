module.exports = [
  {
    text: 'Guide',
    link: '/en/quick-start.html',
  },
  {
    text: 'Config Reference',
    ariaLabel: 'Config Reference',
    children: [
      {
        text: 'Client',
        ariaLabel: 'Client',
        children: [
          {
            text: 'Basic Configure',
            link: '/en/client/basic.html',
          },
          {
            text: 'Internationalization',
            link: '/en/client/i18n.html',
          },
          {
            text: 'Reading Statistics',
            link: '/en/client/visitor.html',
          },
        ],
      },
      {
        text: 'Server',
        ariaLabel: 'Server',
        children: [
          {
            text: 'Basic Configure',
            link: '/en/server/basic.html',
          },
          {
            text: 'Comment Notification',
            link: '/en/server/notification.html',
          },
          {
            text: 'Othere Databases',
            link: '/en/server/databases.html',
          },
          {
            text: 'Independent Deployment',
            link: '/en/server/vps-deploy.html',
          },
        ],
      },
    ],
  },
  {
    text: 'Migration',
    children: [
      {
        text: 'Valine Migration Guide',
        link: '/en/migration.html',
      },
      {
        text: 'Data Migration Helper',
        link: '/migration/tool.html',
      },
    ],
  },
  {
    text: 'Learn More',
    ariaLabel: 'Learn More',
    children: [
      {
        text: 'API',
        link: '/en/api.html',
      },
      {
        text: 'Contributing Guide',
        link: '/en/development.html',
      },
      {
        text: 'FAQ',
        link: '/en/faq.html',
      },
    ],
  },
];
