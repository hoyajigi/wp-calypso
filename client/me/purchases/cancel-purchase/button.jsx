/**
 * External Dependencies
 */
import page from 'page';
import React from 'react';
import shuffle from 'lodash/shuffle';

/**
 * Internal Dependencies
 */
import wpcom from 'lib/wp';
import config from 'config';
import analytics from 'lib/analytics';
import Button from 'components/button';
import { cancelAndRefundPurchase, cancelPurchase } from 'lib/upgrades/actions';
import { clearPurchases } from 'state/purchases/actions';
import { connect } from 'react-redux';
import Dialog from 'components/dialog';
import { getName, getSubscriptionEndDate, isOneTimePurchase, isRefundable, isSubscription } from 'lib/purchases';
import { isDomainRegistration, isTheme, isGoogleApps } from 'lib/products-values';
import notices from 'notices';
import paths from 'me/purchases/paths';
import { refreshSitePlans } from 'state/sites/plans/actions';
import FormSectionHeading from 'components/forms/form-section-heading';
import FormFieldset from 'components/forms/form-fieldset';
import FormLegend from 'components/forms/form-legend';
import FormLabel from 'components/forms/form-label';
import FormRadio from 'components/forms/form-radio';
import FormTextInput from 'components/forms/form-text-input';
import FormTextarea from 'components/forms/form-textarea';

/**
 * Module dependencies
 */
import debugFactory from 'debug';
const debug = debugFactory( 'calypso:purchases:survey' );

const CancelPurchaseButton = React.createClass( {
	propTypes: {
		purchase: React.PropTypes.object.isRequired,
		selectedSite: React.PropTypes.object.isRequired
	},

	getInitialState() {
		// shuffle reason order, but keep anotherReasonOne last
		const questionOneOrder = shuffle( [
			'couldNotInstall',
			'tooHard',
			'didNotInclude',
			'onlyNeedFree'
		] );
		questionOneOrder.push( 'anotherReasonOne' );

		const questionTwoOrder = shuffle( [
			'stayingHere',
			'otherWordPress',
			'differentService',
			'noNeed'
		] );
		questionTwoOrder.push( 'anotherReasonTwo' );

		return {
			disabled: false,
			showDialog: false,
			isRemoving: false,
			surveyStep: 1,
			questionOneRadio: null,
			questionOneText: '',
			questionOneOrder: questionOneOrder,
			questionTwoRadio: null,
			questionTwoText: '',
			questionTwoOrder: questionTwoOrder,
			questionThreeText: ''
		};
	},

	handleCancelPurchaseClick() {
		if ( isDomainRegistration( this.props.purchase ) ) {
			return this.goToCancelConfirmation();
		}

		this.setState( {
			showDialog: true
		} );
	},

	closeDialog() {
		this.setState( {
			showDialog: false
		} );
	},

	changeSurveyStep() {
		this.setState( {
			surveyStep: this.state.surveyStep === 1 ? 2 : 1,
		} );
	},

	handleRadioOne( event ) {
		this.setState( {
			questionOneRadio: event.currentTarget.value,
			questionOneText: ''
		} );
	},

	handleTextOne( event ) {
		this.setState( {
			questionOneText: event.currentTarget.value
		} );
	},

	handleRadioTwo( event ) {
		this.setState( {
			questionTwoRadio: event.currentTarget.value,
			questionTwoText: ''
		} );
	},

	handleTextTwo( event ) {
		this.setState( {
			questionTwoText: event.currentTarget.value
		} );
	},

	handleTextThree( event ) {
		this.setState( {
			questionThreeText: event.currentTarget.value
		} );
	},

	renderCancelConfirmationDialog() {
		const buttons = {
				close: {
					action: 'close',
					label: this.translate( "No, I'll Keep It" )
				},
				next: {
					action: 'next',
					disabled: this.state.isRemoving ||
						this.state.questionOneRadio === null ||
						this.state.questionTwoRadio === null ||
						( this.state.questionOneRadio === 'anotherReasonOne' && this.state.questionOneText === '' ) ||
						( this.state.questionTwoRadio === 'anotherReasonTwo' && this.state.questionTwoText === '' ),
					label: this.translate( 'Next' ),
					onClick: this.changeSurveyStep
				},
				prev: {
					action: 'prev',
					disabled: this.state.isRemoving,
					label: this.translate( 'Previous' ),
					onClick: this.changeSurveyStep
				},
				cancel: {
					action: 'cancel',
					label: this.translate( 'Yes, Cancel Now' ),
					isPrimary: true,
					disabled: this.state.submitting,
					onClick: this.submitCancelAndRefundPurchase
				}
			},
			purchaseName = getName( this.props.purchase ),
			inStepOne = this.state.surveyStep === 1;

		let buttonsArr, dialogContent;
		if ( ! config.isEnabled( 'upgrades/refund-survey' ) ) {
			buttonsArr = [ buttons.close, buttons.cancel ];
			dialogContent = this.renderCancellationEffect();
		} else {
			buttonsArr = ( inStepOne ) ? [ buttons.close, buttons.next ] : [ buttons.close, buttons.prev, buttons.cancel ];
			dialogContent = ( inStepOne ) ? this.renderDialogContentOne() : this.renderDialogContentTwo();
		}

		return (
			<Dialog
				isVisible={ this.state.showDialog }
				buttons={ buttonsArr }
				onClose={ this.closeDialog }
				className="cancel-purchase-button__warning-dialog">
				<FormSectionHeading>{ this.translate( 'Cancel %(purchaseName)s', { args: { purchaseName } } ) }</FormSectionHeading>
				{ dialogContent }
			</Dialog>
		);
	},

	goToCancelConfirmation() {
		const { id } = this.props.purchase,
			{ slug } = this.props.selectedSite;

		page( paths.confirmCancelDomain( slug, id ) );
	},

	cancelPurchase() {
		const { purchase } = this.props;

		this.toggleDisabled();

		if ( config.isEnabled( 'upgrades/refund-survey' ) ) {
			const survey = wpcom.marketing().survey( 'calypso-remove-purchase', this.props.selectedSite.ID );
			survey.addResponses( {
				'why-cancel': {
					response: this.state.questionOneRadio,
					text: this.state.questionOneText
				},
				'next-adventure': {
					response: this.state.questionTwoRadio,
					text: this.state.questionTwoText
				},
				'what-better': { text: this.state.questionThreeText },
				purchase: purchase,
				type: 'refund'
			} );

			debug( 'Survey responses', survey );
			survey.submit()
				.then( res => {
					debug( 'Survey submit response', res );
					if ( ! res.success ) {
						notices.error( res.err );
					}
				} )
				.catch( err => debug( err ) ); // shouldn't get here
		}

		cancelPurchase( purchase.id, ( success ) => {
			const purchaseName = getName( purchase ),
				subscriptionEndDate = getSubscriptionEndDate( purchase );

			this.props.refreshSitePlans( purchase.siteId );

			this.props.clearPurchases();

			if ( success ) {
				notices.success( this.translate(
					'%(purchaseName)s was successfully cancelled. It will be available ' +
					'for use until it expires on %(subscriptionEndDate)s.',
					{
						args: {
							purchaseName,
							subscriptionEndDate
						}
					}
				), { persistent: true } );

				page( paths.list() );
			} else {
				notices.error( this.translate(
					'There was a problem canceling %(purchaseName)s. ' +
					'Please try again later or contact support.',
					{
						args: { purchaseName }
					}
				) );
				this.cancellationFailed();
			}
		} );
	},

	cancellationFailed() {
		this.closeDialog();

		this.setState( {
			submitting: false
		} );
	},

	toggleDisabled() {
		this.setState( {
			disabled: ! this.state.disabled
		} );
	},

	handleSubmit( error, response ) {
		if ( error ) {
			notices.error( error.message );

			this.cancellationFailed();

			return;
		}

		notices.success( response.message, { persistent: true } );

		this.props.refreshSitePlans( this.props.purchase.siteId );

		this.props.clearPurchases();

		analytics.tracks.recordEvent(
			'calypso_purchases_cancel_form_submit',
			{ product_slug: this.props.purchase.productSlug }
		);

		page.redirect( paths.list() );
	},

	submitCancelAndRefundPurchase() {
		this.setState( {
			submitting: true
		} );

		cancelAndRefundPurchase( this.props.purchase.id, { product_id: this.props.purchase.productId }, this.handleSubmit );
	},

	renderCancellationEffect() {
		const { domain, refundText } = this.props.purchase,
			purchaseName = getName( this.props.purchase );

		let cancelationEffectText = this.translate(
			'All plan features and custom changes will be removed from your site and you will be refunded %(cost)s.', {
				args: {
					cost: refundText
				}
			}
		);

		if ( isTheme( this.props.purchase ) ) {
			cancelationEffectText = this.translate(
				'Your site\'s appearance will revert to its previously selected theme and you will be refunded %(cost)s.', {
					args: {
						cost: refundText
					}
				}
			);
		}

		if ( isGoogleApps( this.props.purchase ) ) {
			cancelationEffectText = this.translate(
				'You will be refunded %(cost)s, but your Google Apps account will continue working without interruption. ' +
				'You will be able to manage your Google Apps billing directly through Google.', {
					args: {
						cost: refundText
					}
				}
			);
		}

		return (
			<p>
				{ this.translate(
					'Are you sure you want to cancel and remove %(purchaseName)s from {{em}}%(domain)s{{/em}}? ', {
						args: {
							purchaseName,
							domain
						},
						components: {
							em: <em />
						}
					}
				) }
				{ cancelationEffectText }
			</p>
		);
	},

	renderQuestionOne() {
		const reasons = {};

		const couldNotInstallInput = (
			<FormTextInput
				className="cancel-purchase__reason-input"
				name="couldNotInstallInput"
				id="couldNotInstallInput"
				value={ this.state.questionOneText }
				onChange={ this.handleTextOne }
				placeholder={ this.translate( 'What plugin/theme were you trying to install?' ) } />
		);
		reasons.couldNotInstall = (
			<FormLabel key="couldNotInstall">
				<FormRadio
					name="couldNotInstall"
					value="couldNotInstall"
					checked={ 'couldNotInstall' === this.state.questionOneRadio }
					onChange={ this.handleRadioOne } />
				<span>{ this.translate( 'I couldn\'t install a plugin/theme I wanted.' ) }</span>
				{ 'couldNotInstall' === this.state.questionOneRadio && couldNotInstallInput }
			</FormLabel>
		);

		const tooHardInput = (
			<FormTextInput
				className="cancel-purchase__reason-input"
				name="tooHardInput"
				id="tooHardInput"
				value={ this.state.questionOneText }
				onChange={ this.handleTextOne }
				placeholder={ this.translate( 'Where did you run into problems?' ) } />
		);
		reasons.tooHard = (
			<FormLabel key="tooHard">
				<FormRadio
					name="tooHard"
					value="tooHard"
					checked={ 'tooHard' === this.state.questionOneRadio }
					onChange={ this.handleRadioOne } />
				<span>{ this.translate( 'It was too hard to set up my site.' ) }</span>
				{ 'tooHard' === this.state.questionOneRadio && tooHardInput }
			</FormLabel>
		);

		const didNotIncludeInput = (
			<FormTextInput
				className="cancel-purchase__reason-input"
				name="didNotIncludeInput"
				id="didNotIncludeInput"
				value={ this.state.questionOneText }
				onChange={ this.handleTextOne }
				placeholder={ this.translate( 'What are we missing that you need?' ) } />
		);
		reasons.didNotInclude = (
			<FormLabel key="didNotInclude">
				<FormRadio
					name="didNotInclude"
					value="didNotInclude"
					checked={ 'didNotInclude' === this.state.questionOneRadio }
					onChange={ this.handleRadioOne } />
				<span>{ this.translate( 'This upgrade didn\'t include what I needed.' ) }</span>
				{ 'didNotInclude' === this.state.questionOneRadio && didNotIncludeInput }
			</FormLabel>
		);

		const onlyNeedFreeInput = (
			<FormTextInput
				className="cancel-purchase__reason-input"
				name="onlyNeedFreeInput"
				id="onlyNeedFreeInput"
				value={ this.state.questionOneText }
				onChange={ this.handleTextOne }
				placeholder={ this.translate( 'How can we improve our upgrades?' ) } />
		);
		reasons.onlyNeedFree = (
			<FormLabel key="onlyNeedFree">
				<FormRadio
					name="onlyNeedFree"
					value="onlyNeedFree"
					checked={ 'onlyNeedFree' === this.state.questionOneRadio }
					onChange={ this.handleRadioOne } />
				<span>{ this.translate( 'All I need is the free plan.' ) }</span>
				{ 'onlyNeedFree' === this.state.questionOneRadio && onlyNeedFreeInput }
			</FormLabel>
		);

		const anotherReasonOneInput = (
			<FormTextInput
				className="cancel-purchase__reason-input"
				name="anotherReasonOneInput"
				value={ this.state.questionOneText }
				onChange={ this.handleTextOne }
				id="anotherReasonOneInput" />
		);
		reasons.anotherReasonOne = (
			<FormLabel key="anotherReasonOne">
				<FormRadio
					name="anotherReasonOne"
					value="anotherReasonOne"
					checked={ 'anotherReasonOne' === this.state.questionOneRadio }
					onChange={ this.handleRadioOne } />
				<span>{ this.translate( 'Another reason…' ) }</span>
				{ 'anotherReasonOne' === this.state.questionOneRadio && anotherReasonOneInput }
			</FormLabel>
		);

		const { questionOneOrder } = this.state,
			orderedReasons = questionOneOrder.map( question => reasons[ question ] );

		return (
			<div>
				<FormLegend>{ this.translate( 'Please tell us why you are canceling:' ) }</FormLegend>
				{ orderedReasons }
			</div>
		);
	},

	renderQuestionTwo() {
		const reasons = {};

		reasons.stayingHere = (
			<FormLabel key="stayingHere">
				<FormRadio
					name="stayingHere"
					value="stayingHere"
					checked={ 'stayingHere' === this.state.questionTwoRadio }
					onChange={ this.handleRadioTwo } />
				<span>{ this.translate( 'I\'m staying here and using the free plan.' ) }</span>
			</FormLabel>
		);

		const otherWordPressInput = (
			<FormTextInput
				className="cancel-purchase__reason-input"
				name="otherWordPressInput"
				id="otherWordPressInput"
				value={ this.state.questionTwoText }
				onChange={ this.handleTextTwo }
				placeholder={ this.translate( 'Mind telling us where?' ) } />
		);
		reasons.otherWordPress = (
			<FormLabel key="otherWordPress">
				<FormRadio
					name="otherWordPress"
					value="otherWordPress"
					checked={ 'otherWordPress' === this.state.questionTwoRadio }
					onChange={ this.handleRadioTwo } />
				<span>{ this.translate( 'I\'m going to use WordPress somewhere else.' ) }</span>
				{ 'otherWordPress' === this.state.questionTwoRadio && otherWordPressInput }
			</FormLabel>
		);

		const differentServiceInput = (
			<FormTextInput
				className="cancel-purchase__reason-input"
				name="differentServiceInput"
				id="differentServiceInput"
				value={ this.state.questionTwoText }
				onChange={ this.handleTextTwo }
				placeholder={ this.translate( 'Mind telling us which one?' ) } />
		);
		reasons.differentService = (
			<FormLabel key="differentService">
				<FormRadio
					name="differentService"
					value="differentService"
					checked={ 'differentService' === this.state.questionTwoRadio }
					onChange={ this.handleRadioTwo } />
				<span>{ this.translate( 'I\'m going to use a different service for my website or blog.' ) }</span>
				{ 'differentService' === this.state.questionTwoRadio && differentServiceInput }
			</FormLabel>
		);

		const noNeedInput = (
			<FormTextInput
				className="cancel-purchase__reason-input"
				name="noNeedInput"
				id="noNeedInput"
				value={ this.state.questionTwoText }
				onChange={ this.handleTextTwo }
				placeholder={ this.translate( 'What will you do instead?' ) } />
		);
		reasons.noNeed = (
			<FormLabel key="noNeed">
				<FormRadio
					name="noNeed"
					value="noNeed"
					checked={ 'noNeed' === this.state.questionTwoRadio }
					onChange={ this.handleRadioTwo } />
				<span>{ this.translate( 'I no longer need a website or blog.' ) }</span>
				{ 'noNeed' === this.state.questionTwoRadio && noNeedInput }
			</FormLabel>
		);

		const anotherReasonTwoInput = (
			<FormTextInput
				className="cancel-purchase__reason-input"
				name="anotherReasonTwoInput"
				value={ this.state.questionTwoText }
				onChange={ this.handleTextTwo }
				id="anotherReasonTwoInput" />
		);
		reasons.anotherReasonTwo = (
			<FormLabel key="anotherReasonTwo">
				<FormRadio
					name="anotherReasonTwo"
					value="anotherReasonTwo"
					checked={ 'anotherReasonTwo' === this.state.questionTwoRadio }
					onChange={ this.handleRadioTwo } />
				<span>{ this.translate( 'Another reason…' ) }</span>
				{ 'anotherReasonTwo' === this.state.questionTwoRadio && anotherReasonTwoInput }
			</FormLabel>
		);

		const { questionTwoOrder } = this.state,
			orderedReasons = questionTwoOrder.map( question => reasons[ question ] );

		return (
			<div>
				<FormLegend>{ this.translate( 'Where is your next adventure taking you?' ) }</FormLegend>
				{ orderedReasons }
			</div>
		);
	},

	renderFreeformQuestion() {
		return (
			<FormFieldset>
				<FormLabel>
					{ this.translate( 'What\'s one thing we could have done better? (optional)' ) }
					<FormTextarea
						name="improvementInput"
						id="improvementInput"
						value={ this.state.questionThreeText }
						onChange={ this.handleTextThree } />
				</FormLabel>
			</FormFieldset>
		);
	},

	renderDialogContentOne() {
		return (
			<div>
				{ this.renderQuestionOne() }
				{ this.renderQuestionTwo() }
			</div>
		);
	},

	renderDialogContentTwo() {
		return (
			<div>
				{ this.renderFreeformQuestion() }
				{ this.renderCancellationEffect() }
			</div>
		);
	},

	render() {
		const { purchase } = this.props;

		let text, onClick;

		if ( isRefundable( purchase ) ) {
			onClick = this.handleCancelPurchaseClick;

			if ( isDomainRegistration( purchase ) ) {
				text = this.translate( 'Cancel Domain and Refund' );
			}

			if ( isSubscription( purchase ) ) {
				text = this.translate( 'Cancel Subscription and Refund' );
			}

			if ( isOneTimePurchase( purchase ) ) {
				text = this.translate( 'Cancel and Refund' );
			}
		} else {
			onClick = this.cancelPurchase;

			if ( isDomainRegistration( purchase ) ) {
				text = this.translate( 'Cancel Domain' );
			}

			if ( isSubscription( purchase ) ) {
				text = this.translate( 'Cancel Subscription' );
			}
		}

		return (
			<div>
				<Button
					className="cancel-purchase__button"
					disabled={ this.state.disabled }
					onClick={ onClick }
					primary>
					{ text }
				</Button>
				{ this.renderCancelConfirmationDialog() }
			</div>

		);
	}
} );

export default connect(
	null,
	{
		clearPurchases,
		refreshSitePlans
	}
)( CancelPurchaseButton );
