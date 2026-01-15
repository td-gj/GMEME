import { defineConfig } from 'vitepress'

export default defineConfig({
    title: "GMEME Documentation",
    description: "Official documentation for GMEME Web3 Arena",
    titleTemplate: ':title | GMEME Docs',

    head: [
        ['link', { rel: 'icon', href: '/favicon.ico' }]
    ],

    themeConfig: {
        logo: '/G.svg',
        siteTitle: 'GMEME Docs',

        nav: [
            { text: 'Home', link: '/' },
            { text: 'Game Features', link: '/guide/features' },
            { text: 'Smart Contracts', link: '/contracts/overview' },
            { text: 'Play Game', link: 'http://localhost:5173' }
        ],

        sidebar: [
            {
                text: 'Game Guide',
                items: [
                    { text: 'All Features', link: '/guide/features' }
                ]
            },
            {
                text: 'Blockchain',
                items: [
                    { text: 'Contract Addresses', link: '/contracts/overview' }
                ]
            }
        ],

        socialLinks: [
            { icon: 'github', link: 'https://github.com/your-repo/gmeme' }
        ],

        footer: {
            message: 'Released under the MIT License.',
            copyright: 'Copyright © 2026 GJTEAM'
        },

        search: {
            provider: 'local'
        }
    }
})
