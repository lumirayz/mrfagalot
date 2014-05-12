//
// parseJid
//
function parseJid(jid) {
	var sp = jid.split("/");
	var bare = sp[0];
	if(sp.length > 1) {
		var resource = sp.slice(1).join("/");
	}
	else {
		var resource = undefined;
	}
	var nd = bare.split("@");
	if(nd.length > 1) {
		var name = nd.slice(0, nd.length - 1).join("@");
		var domain = nd[nd.length - 1];
	}
	else {
		var name = undefined;
		var domain = nd[0];
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
