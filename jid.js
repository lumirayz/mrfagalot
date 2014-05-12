"use strict";

//
// parseJid
//
function parseJid(jid) {
	var
		sp   = jid.split("/"),
		bare = sp[0],
		name,
		domain,
		resource;
	if(sp.length > 1) {
		resource = sp.slice(1).join("/");
	}
	else {
		resource = undefined;
	}
	var nd = bare.split("@");
	if(nd.length > 1) {
		name = nd.slice(0, nd.length - 1).join("@");
		domain = nd[nd.length - 1];
	}
	else {
		name = undefined;
		domain = nd[0];
	}
	return {
		bare: bare,
		name: name,
		domain: domain,
		resource: resource,
		jid: jid
	};
}

//
// Exports
//
module.exports = parseJid;
