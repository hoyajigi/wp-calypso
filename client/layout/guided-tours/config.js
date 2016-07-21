/** @ssr-ready **/

/**
 * External dependencies
 */
import React from 'react';
import i18n from 'i18n-calypso';
import config from 'config';

/**
 * Internal dependencies
 */
import { getSelectedSite, getSectionName, isPreviewShowing } from 'state/ui/selectors';
import { isFetchingNextPage, getQueryParams, getThemesList } from 'state/themes/themes-list/selectors';
import { isMobile } from 'lib/viewport';

const tours = {
	main: {
		meta: {
			version: '20160601',
			path: '/',
			context: () => false,
		},
		init: {
			text: i18n.translate( "{{strong}}Need a hand?{{/strong}} We'd love to show you around the place, and give you some ideas for what to do next.", {
				components: {
					strong: <strong />,
				}
			} ),
			type: 'FirstStep',
			placement: 'right',
			next: 'my-sites',
		},
		'my-sites': {
			target: 'my-sites',
			arrow: 'top-left',
			type: 'ActionStep',
			icon: 'my-sites',
			placement: 'below',
			text: i18n.translate( "{{strong}}First things first.{{/strong}} Up here, you'll find tools for managing your site's content and design.", {
				components: {
					strong: <strong />,
				}
			} ),
			next: 'sidebar',
		},
		sidebar: {
			text: i18n.translate( 'This menu lets you navigate around, and will adapt to give you the tools you need when you need them.' ),
			type: 'BasicStep',
			target: 'sidebar',
			arrow: 'left-middle',
			placement: 'beside',
			next: 'click-preview',
		},
		'click-preview': {
			target: 'site-card-preview',
			arrow: 'top-left',
			type: 'ActionStep',
			iconText: i18n.translate( "your site's name", {
				context: "Click your site's name to continue.",
			} ),
			placement: 'below',
			showInContext: state => getSelectedSite( state ) && getSelectedSite( state ).is_previewable,
			text: i18n.translate( "This shows your currently {{strong}}selected site{{/strong}}'s name and address.", {
				components: {
					strong: <strong />,
				}
			} ),
			next: 'in-preview',
		},
		'in-preview': {
			text: i18n.translate( "This is your site's {{strong}}Preview{{/strong}}. From here you can see how your site looks to others.", {
				components: {
					strong: <strong />,
				}
			} ),
			type: 'BasicStep',
			placement: 'center',
			showInContext: state => getSelectedSite( state ) && getSelectedSite( state ).is_previewable,
			next: 'close-preview',
		},
		'close-preview': {
			target: 'web-preview__close',
			arrow: 'left-top',
			type: 'ActionStep',
			placement: 'beside',
			icon: 'cross-small',
			text: i18n.translate( 'Take a look at your site — and then close the site preview. You can come back here anytime.' ),
			showInContext: state => getSelectedSite( state ) && getSelectedSite( state ).is_previewable,
			next: 'themes',
		},
		themes: {
			text: i18n.translate( "Change your {{strong}}Theme{{/strong}} to choose a new layout, or {{strong}}Customize{{/strong}} your theme's colors, fonts, and more.", {
				components: {
					strong: <strong />,
				}
			} ),
			type: 'BasicStep',
			target: 'themes',
			arrow: 'top-left',
			placement: 'below',
			showInContext: state => getSelectedSite( state ) && getSelectedSite( state ).is_customizable,
			next: 'finish',
		},
		finish: {
			placement: 'center',
			text: i18n.translate( "{{strong}}That's it!{{/strong}} Now that you know a few of the basics, feel free to wander around.", {
				components: {
					strong: <strong />,
				}
			} ),
			type: 'FinishStep',
			linkLabel: i18n.translate( 'Learn more about WordPress.com' ),
			linkUrl: 'https://learn.wordpress.com',
		},
	},
	themes: {
		meta: {
			version: '20160609',
			path: '/design',
			// insert magical new selectors here
			// don't enable this in production (yet)
			context: () => 'production' !== config( 'env' ),
		},
		description: 'Learn how to find and activate a theme',
		showInContext: state => getSectionName( state ) === 'themes',
		init: {
			text: i18n.translate( 'Find a theme thats good for you.' ),
			type: 'FirstStep',
			placement: 'right',
			next: isMobile() ? 'mobileSearch' : 'search',
		},
		mobileSearch: {
			text: i18n.translate( 'Click the search button to search for themes' ),
			type: 'ActionStep',
			target: '.themes__search-card .search-open__icon',
			placement: 'below',
			arrow: 'top-left',
			next: 'search',
		},
		search: {
			text: i18n.translate( 'Here you can search for a specific theme name or feature, try trying something ( e.g. "business" ).' ),
			type: 'ActionStep',
			target: '.themes__search-card .search-open__icon',
			placement: 'below',
			continueIf: state => {
				const params = getQueryParams( state );
				return params && params.search && params.search.length && ! isFetchingNextPage( state ) && getThemesList( state ).length > 0;
			},
			arrow: 'top-left',
			next: isMobile() ? 'mobileCloseSearch' : 'filter',
		},
		mobileCloseSearch: {
			text: i18n.translate( 'Close the search' ),
			type: 'ActionStep',
			target: '.themes__search-card .search-close__icon',
			placement: 'below',
			arrow: 'top-left',
			next: 'mobileFilter',
		},
		filter: {
			text: i18n.translate( 'You can filter between free & paid themes. Try filtering by free themes' ),
			type: 'ActionStep',
			target: 'themes-tier-dropdown',
			placement: 'above',
			continueIf: state => {
				const params = getQueryParams( state );
				return params && params.tier === 'free';
			},
			arrow: 'bottom-right',
			next: 'choose-theme',
		},
		mobileFilter: {
			text: i18n.translate( 'You can filter between free & paid themes. Try filtering by free themes' ),
			type: 'ActionStep',
			target: '.themes__search-card .section-nav__mobile-header',
			placement: 'above',
			showInContext: () => isMobile(),
			continueIf: state => {
				const params = getQueryParams( state );
				return params && params.tier === 'free'; // probably want to allow any selection, and check it's changed
			},
			arrow: 'top-right',
			next: 'choose-theme',
		},
		'choose-theme': {
			text: i18n.translate( 'Tap on any theme to see more details, or tap ••• to open all the theme options.' ),
			type: 'ActionStep',
			placement: 'center',
			showInContext: state => getSectionName( state ) === 'themes',
			continueIf: state => getSectionName( state ) === 'theme',
			next: 'tab-bar',
		},
		'tab-bar': {
			text: i18n.translate( 'Here you can read all the details about the theme, its support — and if available, the setup documentation.' ),
			type: 'BasicStep',
			placement: 'center',
			target: '.section-nav',
			showInContext: state => getSectionName( state ) === 'theme',
			next: 'live-preview',
		},
		'live-preview': {
			text: i18n.translate( 'Tap here to see a live demo of the theme.' ),
			type: 'ActionStep',
			placement: 'below',
			target: 'theme-sheet-preview',
			showInContext: state => getSectionName( state ) === 'theme',
			arrow: 'top-left',
			next: 'close-preview',
		},
		'close-preview': {
			target: '.web-preview.is-visible [data-tip-target="web-preview__close"]',
			arrow: 'left-top',
			type: 'ActionStep',
			placement: 'beside',
			icon: 'cross-small',
			text: i18n.translate( 'Tap to close the live preview.' ),
			showInContext: state => state && isPreviewShowing( state ),
			next: 'finish',
		},
		finish: {
			placement: 'center',
			text: i18n.translate( "That's it! You can choose to activate this theme now, or continue having a look around.", {
				components: {
					strong: <strong />,
				}
			} ),
			type: 'FinishStep',
		},
	},
	test: {
		meta: {
			version: '20160719',
			path: '/test',
			// don't enable this in production
			context: () => 'production' !== config( 'env' ),
		},
	},
};

function get( tour ) {
	return tours[ tour ] || null;
}

function getAll() {
	return tours;
}

export default {
	get,
	getAll,
};
