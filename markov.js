//
// Requires
//
var
	_ = require("underscore"),
	fs = require("fs");

//
// Util
//
var util = {
	endsWith: function(s, ss) {
		if(s.length < ss.length) {return false;}
		return s.substr(s.length - ss.length) === ss;
	},
	choice: function(arr) {
		if(arr.length !== 0) {
			return arr[Math.floor(Math.random() * arr.length)];
		}
		return null;
	}
};

//
// Ngram operations
//
function ngramToKey(arr) {
	return arr.join("\x00");
}
function keyToNgram(key) {
	return key.split("\x00");
}

//
// Tokenizers
//
var tokenizers = {
	simpleTokenizer: function(msg) {
		return [msg.split(/[ \t\r\n]+/)];
	},
	lineTokenizer: function(msg) {
		return _.map(msg.split(/[\r\n]+/), function(s) {
			return s.split(/[ \t]+/);
		});
	},
	wordTokenizer: function(msg) {
		return _.chain(msg.replace(/[ \t\n\r"]+/g, " ").split(/[\.!\?]+/))
			.map(function(s) {return s.replace(/^[, ]+/, "").split(/[ ]+/g);})
			.filter(function(s) {return s.length > 2;})
			.value();
	}
};

//
// AINet
//
function AINet(ngramsize, tokenizer) {
	this._net           = {};
	this._inet          = {};
	this._starts        = [];
	this._ends          = [];
	this._ngramFreqs    = {};
	this._ngramsize     = ngramsize;
	this._tokenizer     = tokenizer || tokenizers.wordTokenizer;
	this._maxIterations = 100;
}

AINet.prototype.getNextWords = function(ngram) {
	var key = ngramToKey(ngram);
	if(this._net.hasOwnProperty(key)) {
		return this._net[key];
	}
	return [];
};

AINet.prototype.getPreviousWords = function(ngram) {
	var key = ngramToKey(ngram);
	if(this._inet.hasOwnProperty(key)) {
		return this._inet[key];
	}
	return [];
};

AINet.prototype.randomNextWord = function(ngram) {
	return util.choice(this.getNextWords(ngram));
};

AINet.prototype.randomPreviousWord = function(ngram) {
	return util.choice(this.getPreviousWords(ngram));
};

AINet.prototype._hitNgram = function(ngram) {
	var key = ngramToKey(ngram);
	if(!this._ngramFreqs.hasOwnProperty(key)) {
		this._ngramFreqs[key] = 0;
	}
	this._ngramFreqs[key]++;
};

AINet.prototype.feed = function(arr) {
	var i, ngram, key, prev, next;
	if(arr.length < this._ngramsize) {
		return;
	}
	_.each(this.getNgrams(arr), function(ngram) {
		this._hitNgram(ngram);
	}, this);
	this._starts.push(arr.slice(0, this._ngramsize));
	this._ends.push(arr.slice(arr.length - this._ngramsize, arr.length));
	for(i = 0; i < arr.length - this._ngramsize; i++) {
		ngram = arr.slice(i, i + this._ngramsize);
		key = ngramToKey(ngram);
		next = arr[i + this._ngramsize];
		if(!this._net.hasOwnProperty(key)) {
			this._net[key] = [];
		}
		this._net[key].push(next);
	}
	for(i = arr.length; i > this._ngramsize; i--) {
		ngram = arr.slice(i - this._ngramsize, i);
		key   = ngramToKey(ngram);
		prev  = arr[i - this._ngramsize - 1];
		if(!this._inet.hasOwnProperty(key)) {
			this._inet[key] = [];
		}
		this._inet[key].push(prev);
	}
};

AINet.prototype.feedText = function(text) {
	_.each(this._tokenizer(text), function(sentence) {
		this.feed(sentence);
	}, this);
};

AINet.prototype.getNgrams = function(arr) {
	var i, ngrams = [];
	for(i = 0; i < arr.length - this._ngramsize; i++) {
		var ngram = arr.slice(i, i + this._ngramsize);
		ngrams.push(ngram);
	}
	return ngrams;
};

AINet.prototype.ngramFrequency = function(ngram) {
	if(ngram.length !== this._ngramsize) {return null;}
	var key = ngramToKey(ngram);
	if(this._ngramFreqs.hasOwnProperty(key)) {
		return this._ngramFreqs[key];
	}
	return 0;
};

AINet.prototype.getBaseResponses = function(ngrams) {
	var bases = _.chain(ngrams)
		.filter(function(ngram) {return this.ngramFrequency(ngram) !== 0;}, this)
		.sortBy(function(ngram) {return this.ngramFrequency(ngram);}, this)
		.value();
	return bases;
};

AINet.prototype.generateResponse = function(msg) {
	var li, i, sentences, tokens, ngrams, bases;
	// Tokenize the message
	sentences = this._tokenizer(msg);
	tokens    = _.flatten(sentences);
	// Get the ngram with the least statistical frequency in the network
	// (that still exists!)
	ngrams = this.getNgrams(tokens);
	bases  = this.getBaseResponses(ngrams);
	// Define the score function
	function score(x) {
		if(x === undefined) {return -1;}
		if(x.length === msg.length) {return 0;}
		return Math.max(0, -1 * Math.pow((x.length - 45), 2) + 120) + Math.random() * 15;
	}
	// Generate candidate replies
	li = [];
	for(i = 0; i < 1000; i++) {
		var base = util.choice(bases.slice(0, 2));
		var candidate = this.generateCandidate(base);
		li.push(candidate);
	}
	// Return the one with the maximum score
	return _.max(li, score);
};

AINet.prototype.generateCandidate = function(base) {
	if(base === null) {
		base = keyToNgram(util.choice(_.keys(this._net)));
	}
	var words = _.clone(base);
	var iterCount = 0;
	// TO THE FRONT!
	var end;
	while(true) {
		end = words.slice(words.length - this._ngramsize);
		var nw = this.randomNextWord(end);
		if(nw === null) {
			break;
		}
		else {
			words.push(nw);
			iterCount++;
			if(iterCount > this._maxIterations) {
				break;
			}
		}
	}
	// AND THEN TO THE BACK!
	var start;
	while(true) {
		start = words.slice(0, this._ngramsize);
		var pw = this.randomPreviousWord(start);
		if(pw === null) {
			break;
		}
		else {
			words = [pw].concat(words);
			iterCount++;
			if(iterCount > this._maxIterations) {
				break;
			}
		}
	}
	return words.join(" ");
};

AINet.prototype.toFile = function(file, done) {
	fs.writeFile(file, JSON.stringify({
		net: this._net,
		inet: this._inet,
		starts: this._starts,
		ends: this._ends,
		ngramFreqs: this._ngramFreqs,
		ngramsize: this._ngramsize
	}), "utf-8", done);
};

AINet.fromFile = function(file, done, err, tokenizer) {
	var self = this;
	fs.readFile(file, "utf-8", function(e, data) {
		if(e instanceof Error) {
			err(e);
		}
		else {
			var obj = JSON.parse(data);
			var net = new AINet(obj.ngramsize);
			net._net = obj.net;
			net._inet = obj.inet;
			net._starts = obj.starts;
			net._ends = obj.ends;
			net._ngramFreqs = obj.ngramFreqs;
			if(tokenizer !== undefined) {
				net._tokenizer = tokenizer;
			}
			done(net);
		}
	});
};

//
// Exports
//
exports.AINet = AINet;
exports.tokenizers = tokenizers;
