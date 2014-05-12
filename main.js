"use strict";

//
// Requires
//
var
	_      = require("underscore"),
	xmpp   = require("node-xmpp-client"),
	JID    = require("./jid"),
	NS     = require("./ns"),
	markov = require("./markov"),
	ltx    = require("ltx"),
	domain = require("domain"),
	fs     = require("fs");

var config = require("./config");

//
// Client
//
var cl = new xmpp.Client({
	jid: config.jid,
	password: config.password
});

//
// Constants
//
var
	NICK          = config.nick,
	ROOMS         = config.rooms,
	CHECK_TIMEOUT = 10000,
	CHECK_AMOUNT  = 3;

//
// AI
//
var net;

markov.AINet.fromFile(
	"ai.db",
	function(n) {net = n;},
	function(err) {
		net = new markov.AINet(1, markov.tokenizers.simpleTokenizer);
	},
	markov.tokenizers.simpleTokenizer
);

//
// Room data
//
var default_rdata = function() {
	return {
		last: 0,
		checktime: 0,
		amount: 0
	};
};

var rdatas = {};

function getRoomData(room) {
	return rdatas[room];
}

//
// Actions
//
function joinRoom(room, nick) {
	rdatas[room] = default_rdata();
	cl.send(new ltx.Element("presence", {to: room + "/" + nick})
		.c("x", {xmlns: NS.muc}).up());
}

function messageRoom(room, body) {
	cl.send(new ltx.Element("message", {to: room, type: "groupchat"})
		.c("body").t(body).up());
}

//
// Handlers
//
function handleAI(room, nick, body) {
	if(nick === "a butt") {
		return;
	}
	if(nick === NICK) {
		return;
	}
	var res, rdata = getRoomData(room);
	if(Math.random() * 100 < config.replyProbability || body.match(config.reactRegex)) {
		// Don't accept messages less than 1 second apart.
		if(rdata.last + 1000 > Date.now()) {
			rdata.last = Date.now();
			console.log("REJECTED: Too soon.");
			return;
		}
		rdata.last = Date.now();
		// Update check timeout if it's expired.
		if(rdata.checktime + CHECK_TIMEOUT < Date.now()) {
			rdata.amount    = 0;
			rdata.checktime = Date.now();
		}
		// Increment amount.
		rdata.amount++;
		// If too many responses in a short time, abort.
		if(rdata.amount > CHECK_AMOUNT) {
			console.log("REJECTED: Too much.");
			return;
		}
		res = net.generateResponse(body, markov.tokenizers.simpleTokenizer);
		res = res
			.replace(config.replaceRegex, nick);
	}
	net.feedText(body);
	net.toFile("ai.db");
	return res;
}

function handleMUCMessage(stz) {
	if(stz.is("message") && stz.getChild("body") !== undefined && stz.attrs.type === "groupchat") {
		var
			nick = JID(stz.attrs.from).resource,
			body = stz.getChildText("body").trim(),
			room = JID(stz.attrs.from).bare;
		console.log("[" + room + "] <" + nick + "> " + body);
		if(stz.getChild("delay") !== undefined) {
			return;
		}
		var rep = handleAI(room, nick, body);
		if(rep) {
			messageRoom(room, rep);
		}
	}
}

//
// Events
//
cl.on("online", function() {
	console.log("Connected.");
	ROOMS.forEach(function(room) {
		joinRoom(room, NICK);
	});
});

cl.on("stanza", function(stz) {
	handleMUCMessage(stz);
});
