/**
 * External dependencies
 */
import { connect } from 'react-redux';
import page from 'page';
import React from 'react';
import { bindActionCreators } from 'redux';

/**
 * Internal dependencies
 */
import { fetchSitePlans } from 'state/sites/plans/actions';
import { getPlansBySite } from 'state/sites/plans/selectors';
import { getFlowType } from 'state/jetpack-connect/selectors';
import Main from 'components/main';
import ConnectHeader from './connect-header';
//import observe from 'lib/mixins/data-observe';
import PlanList from 'components/plans/plan-list' ;
import plansFactory from 'lib/plans-list';
import { shouldFetchSitePlans } from 'lib/plans';
import { recordTracksEvent } from 'state/analytics/actions';
import { getCurrentUser } from 'state/current-user/selectors';
import * as upgradesActions from 'lib/upgrades/actions';
import { userCan } from 'lib/site/utils';
import { cartItems } from 'lib/cart-values';
import { isCalypsoStartedConnection } from 'state/jetpack-connect/selectors';
import { selectPlanInAdvance, goBackToWpAdmin } from 'state/jetpack-connect/actions';
import { getPlans } from 'state/plans/selectors';

const plans = plansFactory();

const CALYPSO_REDIRECTION_PAGE = '/posts/';

const Plans = React.createClass( {
	propTypes: {
		cart: React.PropTypes.object.isRequired,
		fetchSitePlans: React.PropTypes.func.isRequired,
		sitePlans: React.PropTypes.object.isRequired,
		showJetpackFreePlan: React.PropTypes.bool
	},

	componentWillUnmount: function() {
		plans.off( 'change', this.autoselectPlan );
	},

	componentDidMount() {
		plans.on( 'change', this.autoselectPlan );

		if ( this.props.flowType === 'pro' || this.props.flowType === 'premium' ) {
			return this.autoselectPlan();
		}

		this.props.recordTracksEvent( 'calypso_jpc_plans_view', {
			user: this.props.userId
		} );
		this.updateSitePlans( this.props.sitePlans );
	},

	autoselectPlan() {
		if ( this.props.flowType === 'pro' ) {
			plans.get();
			const plan = plans.getPlanBySlug( 'jetpack_business' );
			if ( plan ) {
				this.selectPlan( cartItems.getItemForPlan( plan ) );
				return;
			}
		}
		if ( this.props.flowType === 'premium' ) {
			plans.get();
			const plan = plans.getPlanBySlug( 'jetpack_premium' );
			if ( plan ) {
				this.selectPlan( cartItems.getItemForPlan( plan ) );
				return;
			}
		}
	},

	componentWillReceiveProps( props ) {
		if ( ! props.sites ) {
			return;
		}

		if ( this.hasPlan( this.props.selectedSite ) ) {
			page.redirect( CALYPSO_REDIRECTION_PAGE + this.props.selectedSite.slug );
		}
		if ( ! props.canPurchasePlans ) {
			page.redirect( CALYPSO_REDIRECTION_PAGE + this.props.selectedSite.slug );
		}
	},

	updateSitePlans( sitePlans ) {
		this.props.fetchSitePlans( sitePlans, this.props.selectedSite );
	},

	selectFreeJetpackPlan() {
		this.props.recordTracksEvent( 'calypso_jpc_plans_submit_free', {
			user: this.props.userId
		} );
		if ( isCalypsoStartedConnection( this.props.jetpackConnectSessions, this.props.selectedSite.slug ) ) {
			page.redirect( CALYPSO_REDIRECTION_PAGE + this.props.selectedSite.slug );
		} else {
			const { queryObject } = this.props.jetpackConnectAuthorize;
			this.props.goBackToWpAdmin( queryObject.redirect_after_auth );
		}
	},

	hasPlan( site ) {
		return site &&
			site.plan &&
			( site.plan.product_slug === 'jetpack_business' || site.plan.product_slug === 'jetpack_premium' );
	},

	selectPlan( cartItem ) {
		const checkoutPath = `/checkout/${ this.props.selectedSite.slug }`;
		if ( cartItem.product_slug === 'jetpack_premium' ) {
			this.props.recordTracksEvent( 'calypso_jpc_plans_submit_99', {
				user: this.props.userId
			} );
			upgradesActions.addItem( cartItem );
			page( checkoutPath );
		}
		if ( cartItem.product_slug === 'jetpack_business' ) {
			this.props.recordTracksEvent( 'calypso_jpc_plans_submit_299', {
				user: this.props.userId
			} );
			upgradesActions.addItem( cartItem );
			page( checkoutPath );
		}
	},

	storeSelectedPlan( cartItem ) {
		console.log( ( cartItem ? cartItem.product_slug : 'free' ) );
		this.props.selectPlanInAdvance( ( cartItem ? cartItem.product_slug : 'free' ), this.props.siteSlug );
	},

	render() {
		if ( this.props.flowType === 'pro' || this.props.flowType === 'premium' ) {
			return null;
		}

		if ( ! this.props.showFirst &&
			( ! this.props.canPurchasePlans || this.hasPlan( this.props.selectedSite ) )
		) {
			return null;
		}

		const jetpackPlans = plans.get().filter( ( plan ) => {
			return plan.product_type === 'jetpack';
		} );

		const defaultJetpackSite = { jetpack: true, plan: {}, isUpgradeable: () => true };

		return (
			<div>
				<Main>
					<div className="jetpack-connect__plans">
						<ConnectHeader
							showLogo={ false }
							headerText={ this.translate( 'Your site is now connected!' ) }
							subHeaderText={ this.translate( 'Now pick a plan that\'s right for you' ) }
							step={ 1 }
							steps={ 3 } />

						<div id="plans" className="jetpack-connect__plans-list plans has-sidebar">
							<PlanList
								isInSignup={ true }
								site={ this.props.selectedSite ? this.props.selectedSite : defaultJetpackSite }
								plans={ jetpackPlans }
								sitePlans={ this.props.sitePlans }
								cart={ this.props.cart }
								showJetpackFreePlan={ true }
								isSubmitting={ false }
								onSelectPlan={ this.props.showFirst ? this.storeSelectedPlan : this.selectPlan }
								onSelectFreeJetpackPlan={ this.props.showFirst ? this.storeSelectedPlan : this.selectFreeJetpackPlan }/>
						</div>
					</div>
				</Main>
			</div>
		);
	}
} );

export default connect(
	( state, props ) => {
		const user = getCurrentUser( state );
		const selectedSite = props.sites ? props.sites.getSelectedSite() : null;
		return {
			plans: getPlans( state ),
			sitePlans: getPlansBySite( state, selectedSite ),
			jetpackConnectSessions: state.jetpackConnect.jetpackConnectSessions,
			jetpackConnectAuthorize: state.jetpackConnect.jetpackConnectAuthorize,
			userId: user ? user.ID : null,
			canPurchasePlans: userCan( 'manage_options', selectedSite ),
			flowType: getFlowType( state.jetpackConnect.jetpackConnectSessions, selectedSite ),
			selectedSite: selectedSite
		};
	},
	( dispatch ) => {
		var methods = Object.assign( {},
			bindActionCreators( { goBackToWpAdmin, selectPlanInAdvance }, dispatch ),
			{
				fetchSitePlans( sitePlans, site ) {
					if ( shouldFetchSitePlans( sitePlans, site ) ) {
						dispatch( fetchSitePlans( site.ID ) );
					}
				},
				recordTracksEvent( eventName, props ) {
					dispatch( recordTracksEvent( eventName, props ) );
				}
			}
		);

		return methods;
	}
)( Plans );
