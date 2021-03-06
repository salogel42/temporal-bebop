import angular from 'angular';
import angularMeteor from 'angular-meteor';
import template from './stuff.html';
import { Mongo } from 'meteor/mongo';
import { Friends, Relations, Notes, LastReciprocated, UserData } from '../both/collections.js';

relations = Relations;

//XXX
//These should only need to be written once...
//I don't remember why this caused a problem before, probably some dumb reason
Meteor.methods({
    addRelation : function({receiverId, type}) {
        let senderId = Meteor.user().services.facebook.id;
        let selector = {"senderId":senderId, "receiverId":receiverId, "type":type};
        let doc = {"presentLocally":true, "senderMeteorId":Meteor.userId(), "reciprocated":false}
        Object.assign(doc, selector);
        Relations.upsert(selector, {$set: doc})
    },
    removeRelation : function({receiverId, type}) {
        let senderId = Meteor.user().services.facebook.id;
        let selector = {"senderId":senderId, "receiverId":receiverId, "type":type, "reciprocated":false};
        let doc = {"presentLocally":false}
        Relations.update(selector, {$set: doc})
    },
    setNote : function({note}) {
        var id = Meteor.user().services.facebook.id;
        var selector = {"id":id};
        var datum = {"id":id, "note":note};
        Notes.upsert(selector, datum)
    }
})
class ListCtrl {

    subscribeToDBs() {
        Meteor.subscribe("userData")
        Meteor.subscribe("relations")
        Meteor.subscribe("friends")
        Meteor.subscribe("meteorUserData")
        Meteor.subscribe("notes")
        Meteor.subscribe("lastReciprocated")
    }

	constructor($scope, $mdDialog) {
		var that = this;
		that.mdDialog = $mdDialog;

        this.subscribeToDBs()

		$scope.viewModel(this);

		this.helpers({
	      relations() {
	        return Relations.find();
	      }
	    });

		this.helpers({
	      friends() {
              return Friends.find({}, {sort: [["reciprocations", "desc"], ["date_met", "desc"]]})
	      }
	    });

		this.relationTypes = [
			{type: 'hang out soon', text: 'Hang out soon', verb:"hang out soon"},
			{type: 'date or something', text: 'Go on a date or something', verb:"go on a date or something"},
		];

		// this.relationTypes = [
		// 	{type: 'go on a date or something', text: 'Go on a date or something'},
		// 	{type: 'hang out soon', text: 'Hang out soon'},
		// ];

		var tryToGetFriends = function() {
			Meteor.call('getFriends', {}, function(err, resp) {
				if (!resp) {
					setTimeout(tryToGetFriends, 500);
				}
			});
		};
		tryToGetFriends();

		//var tryToGetPicture = function() {
		//	if (!Meteor.user() || !Meteor.user().services) {
	    //		setTimeout(tryToGetPicture, 500);
	    //		return;
	    //	}
		//	Meteor.call('getPicture', {}, function(err, resp) {
		//		if (!resp || !resp.data || !resp.data.url) {
		//			setTimeout(tryToGetPicture, 500);
		//			return;
		//		}
		//		that.userPicture = resp.data.url;
		//	});
		//};
		//tryToGetPicture();

		//this.myNoteText = this.getNote();

		setTimeout(function() {
			that.halfASecondHasPassed = true;
		}, 500);
	}

    relationVerb(type) {
        for (i = 0; i < this.relationTypes.length; i++) {
            if (this.relationTypes[i].type == type) {
                return this.relationTypes[i].verb
            }
        }
    }

	loggingIn() {
		return Meteor.loggingIn();
	}

	getUserData() {
		return UserData.findOne({id:this.getUserId()});
	}

	//getMyNote() {
	//	return this.getNote(this.getUserId());
	//}

    //getNote(id) {
    //	var id = id || this.getUserId();
    //    var doc = Notes.findOne({id:id})
    //    if (!doc) {
    //        return '';
    //    }
    //    return doc.note
    //}

    getFbNameById(id) {
    	return Friends.findOne({id: id});
    }

    submitSelections() {
    	let that = this;

    	that.isSubmitting = true;

        Meteor.call("publishRelations", {}, function(err, resp) {
        	// Dialog text if no new reciprocations
        	let title = 'Your selections have been submitted';
        	let dialogText = 'As they are reciprocated, we will notify you by email and Facebook, and the tick by their name will turn green.';

        	let hasNewReciprocations = resp.length > 0;
        	if (hasNewReciprocations) {
        		title = 'Your desires are reciprocated!';
        		let sentences = resp.map(function(relation) {
        			return 'You and ' + that.getFbNameById(relation.receiverId).name + ' both want to ' + that.relationVerb(relation.type) + '!';
        		});
        		sentences.push('\nAs more friends reciprocate, we will notify you by email and Facebook, and the tick by their name will turn green.');
        		dialogText = sentences.join('\n');

        	}

        	that.isSubmitting = false;

			that.mdDialog.show(
				that.mdDialog.alert()
					.clickOutsideToClose(true)
					.title(title)
					.textContent(dialogText)
					.ariaLabel('no one loves you dialog')
					.ok('Got it!')
			);
        });
    }

    getUserId() {
    	if (!Meteor.user() || !Meteor.user().services) {
    		return;
    	}
    	return Meteor.user().services.facebook.id;
    }

	getUserName() {
		if (!Meteor.user()) {
			return '';
		}
		return Meteor.user().profile.name;
	}

	getUserLink() {
		if (!Meteor.user() || !Meteor.user().services) {
			return '';
		}
		return Meteor.user().services.facebook.link;
	}

    existsRelation() {
        let relation = Relations.findOne({reciprocated:true});
        return relation === undefined
    }

	getFacebookId() {
		if (!Meteor.user() || !Meteor.user().services) {
			return '';
		}
		return Meteor.user().services.facebook.id;
	}

	toggleRelation(receiverId, type) {
		if (this.shouldBeChecked(receiverId, type)){
			Meteor.call('removeRelation', {receiverId: receiverId, type: type}, function(err) {
				// uhhhh
			});
		} else{
			Meteor.call('addRelation', {receiverId: receiverId, type: type}, function(err) {
				// uhhhh
			});
		}
	}

	getRelation(receiverId, type) {
		if (!this.relations) {
			return false;
		}

		return this.relations.find(function(relation) {
			return relation.receiverId == receiverId && relation.type == type;
		});
	}

	shouldBeChecked(receiverId, type) {
		var relation = this.getRelation(receiverId, type);

		return relation && relation.presentLocally;
	}

	needsSaving(receiverId, type) {
		var relation = this.getRelation(receiverId, type);

		if ((relation && !relation.presentOnServer && relation.presentLocally) ||
			(relation && relation.presentOnServer && !relation.presentLocally)) {
			this.somethingNeedsSaving = true;
			return true;
		}
		return false;
	}

	doesSomethingNeedSaving() {
		var that = this;
		var result = false;
		this.friends.forEach(function(friend) {
			that.relationTypes.forEach(function(relationType) {
				if (that.needsSaving(friend.id, relationType.type)) {
					result = true;
				}
			});
		});
		return result;
	}

	lastReciprocated(receiverId, type) {
		if (!Meteor.user() || !Meteor.user().services) {
			return;
		}
		return LastReciprocated.find({
			receiverId: receiverId,
			senderId: Meteor.user().services.facebook.id,
			type: type
		}).fetch();
	}

	setNote(noteText) {
		Meteor.call('setNote', {note: this.myNoteText});
		this.myNoteText = '';
	}

	login() {
        var that = this;
        that.clickedLogin = true;
		Meteor.loginWithFacebook({requestPermissions: ['user_friends', 'email']}, function(err, resp){
			if (err) {
				throw new Meteor.Error("Facebook login failed");
            } else {
                that.subscribeToDBs()
            }
		});
	}

	logout() {
        this.clickedLogin = false;
		Meteor.logout(function(err){
            if (err) {
                throw new Meteor.Error("Logout failed");
            }
        });
	}
}

export default List = angular.module('List', [
	angularMeteor
]).component('list', {
	templateUrl: '/client/stuff.html',
	controller: ['$scope', '$mdDialog', ListCtrl]
});

