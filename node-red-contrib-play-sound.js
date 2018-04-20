module.exports = function(RED) {

	var Player = require('play-sound');
	
	//define state playing and set it to node
	const nodeStatusNormal = {};
	const nodeStatusPlaying = {fill : "green", shape : "dot", text : "playing"};

	/*************/
	// PlaySound //
	/*************/
	function PlaySound_Node(config) {
		RED.nodes.createNode(this, config);
		var node = this;

		node.config = config;
		var playerOptions = {};
		try {
			playerOptions = JSON.parse(config.playerOptions || {});
		} catch(e) {
			node.warn("Invalid playerOptions");
		}
		node.player = require('play-sound')(playerOptions);
		node.playings = {};
		
		node.on('input', function(msg) {
			node.log("Event input: " + msg.payload);

			switch (msg.payload) {
			case "resume":
				node.resume();
				break;
			case "pause":
				node.pause();
				break;
			case "stop":
				node.stop();
				break;
			case "start":
			default:
				node.play(msg);
				break;
			}
		});

		node.play = function(msg) {
			var audioURI = (msg && msg.audioURI) || node.config.audioURI;
			var opts = (msg && msg.options) || node.config.options || {};
			try {
				opts = JSON.parse(opts);
			} catch(e) {
				node.warn("Invalid options");
			}
			
			if( audioURI != null ) {
				node.log("Play: " + audioURI);
				node.status(nodeStatusPlaying);
				var playing = node.player.play(audioURI, opts);
				node.playings[playing.pid] = playing;
		
				playing.on('error', function(error) {
					node.log("Event error:" + error);
				});
				
				playing.on('exit', function(code, signal) {
					node.log("Event exit:" + code + ", " + signal);
		
					if( !msg ) msg = {};
					msg.audioURI = audioURI;
					if( code == 0 )
						msg.payload = "end";
					else
						msg.payload = "stop";
					node.send(msg);

					delete node.playings[playing.pid];
					if( Object.keys(node.playings).length == 0 )
						node.status(nodeStatusNormal);
				});
			} else
				node.error("No audio uri to play");
		}

		node.stop = function(audioURI, msg) {
			for( var p in node.playings) {
				node.playings[p].kill('SIGKILL');
			};
		}

		node.pause = function(audioURI, msg) {
			for( var p in node.playings) {
				node.playings[p].kill('SIGSTOP');
			};
		}

		node.resume = function(audioURI, msg) {
			for( var p in node.playings) {
				node.playings[p].kill('SIGCONT');
			};
		}
	}

	RED.nodes.registerType("PlaySound", PlaySound_Node);

	RED.httpAdmin.post("/PlaySound/:id", RED.auth.needsPermission("debug.write"), function(req, res) {
		var node = RED.nodes.getNode(req.params.id);
		if (node != null) {
			if( Object.keys(node.playings).length > 0 ) {
				node.stop();
				res.sendStatus(200);
			} else {
				node.play();
				res.sendStatus(200);
			}
		} else {
			res.sendStatus(404);
		}
	});
}
