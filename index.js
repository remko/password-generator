/* global $, _, Random */
/* eslint block-scoped-var: 0, no-redeclare: 0 */

$(function () {
	"use strict";

	var random = new Random(Random.browserCrypto);

	function getColorForEntropy(entropy) {
		return entropy < 50 ? "red"
			: entropy > 80 ? "green"
			: "orange";
	}

	////////////////////////////////////////////////////////////////////////////////
	// Diceware
	////////////////////////////////////////////////////////////////////////////////
	
	(function() {
		var lists = [
			{ name: "English", url: "/password-generator/lists/diceware/diceware.wordlist.asc", source: "http://world.std.com/%7Ereinhold/diceware.wordlist.asc" },
			{ name: "English (Beale)", url: "/password-generator/lists/diceware/beale.wordlist.asc", source: "http://world.std.com/%7Ereinhold/beale.wordlist.asc" },
			{ name: "Dutch, No Composite Words (Remko Tronçon)", url: "/password-generator/lists/diceware/diceware-wordlist-nl.txt", source: "/blog/diceware-nl" },
			{ name: "Dutch, Composite Words (Remko Tronçon)", url: "/password-generator/lists/diceware/diceware-wordlist-composites-nl.txt", source: "/blog/diceware-nl" }
		];
		var currentList;
		var currentListSource;

		function setControlsEnabled(enabled) {
			$("#diceware-lists").prop("disabled", !enabled);
			$("#diceware-count").prop("disabled", !enabled);
			$("#diceware").toggleClass("disabled", !enabled);
		}

		function getDicewareWords(list, count) {
			return _.times(count, function () {
				return list[random.integer(0, list.length - 1)];
			}).join(" ");
		}

		function update() {
			if (currentList) {
				$("#diceware-list-count").text("(" + currentList.length + " words)");
				$("#diceware-list-source").attr("href", currentListSource);
				var count = parseInt($("#diceware-count").val(), 10);

				$("#diceware-result")
					.val(getDicewareWords(currentList, count))
					.height(0)
					.height($("#diceware-result").prop('scrollHeight') - 10);

				var entropy = Math.floor(count*Math.log(currentList.length) / Math.log(2));
				$("#diceware-entropy")
					.text("(" + entropy + " bits entropy)")
					.css("color", getColorForEntropy(entropy));
			}
		}

		function loadList() {
			currentList = undefined;
			currentListSource = undefined;
			setControlsEnabled(false);
			var list = lists[$("#diceware-lists").val()];
			$.ajax(list.url)
				.then(function (result) {
					var lines = result.split("\n");
					var newList = [];
					for (var i = 0; i < lines.length; ++i) {
						var m;
						if (m = lines[i].match(/\d\d\d\d\d\s+(.*)/)) { // eslint-disable-line no-cond-assign
							newList.push(m[1]);
						}
					}
					currentList = newList;
					currentListSource = list.source;
				})
				.fail(function (req) {
					console.log(req); // eslint-disable-line no-console
				})
				.always(function () {
					setControlsEnabled(true);
					update();
				});
		}

		$("#diceware-lists").append(lists.map(function (val, i) {
			return $("<option />").val(i).text(val.name);
		}));

		$("#diceware-count").on("change", update);
		$("#diceware-refresh").on("click", update);
		$("#diceware-lists").on("change", loadList);

		loadList();
	})();


	////////////////////////////////////////////////////////////////////////////////
	// Random-letter Passphrases
	////////////////////////////////////////////////////////////////////////////////
	
	(function () {
		var MAX_MNEMONIC_SENTENCES = 20;

		var lists = [
			{ name: "English (Reinhold)", url: "/password-generator/lists/passphrases/reinhold.json" }
		];
		var currentList;

		function setControlsEnabled(enabled) {
			$("#passphrase-lists").prop("disabled", !enabled);
			$("#passphrase-count").prop("disabled", !enabled);
			$("#passphrase").toggleClass("disabled", !enabled);
		}
		
		var partition = _.memoize(function (n, max) {
			var result = [];
			for (var i = Math.min(max, n); i >= 2; --i) {
				if (n - i === 0) {
					result.push([i]);
				}
				else {
					var p = partition(n - i, max).map(function (partition) {
						return [i].concat(partition);
					});
					result = result.concat(p);
				}
			}
			return result;
		});

		function createSentence(sentenceIndices, wordIndices, list) {
			var sentence = sentenceIndices.map(function (sentenceIndex, i) {
				var word = list[sentenceIndex][wordIndices[i]];
				return (i ? word : _.capitalize(word)).replace(new RegExp(
					"(" + String.fromCharCode(97 + wordIndices[i]) 
					+ "|" + String.fromCharCode(65 + wordIndices[i]) + ")" ), "<b>$1</b>");
			});
			return sentence.join(" ") + (sentenceIndices.length > 1 ? "." : "!");
		}

		function update(resetValue) {
			if (currentList) {
				$("#passphrase-list-source").attr("href", currentList.source);

				// Update result (if necessary)
				if (resetValue) {
					var newResult = [];
					var newCount = parseInt($("#passphrase-count").val(), 10);
					for (var i = 0; i < newCount; ++i) {
						newResult.push(random.integer(0, 25));
					}
					$("#passphrase-result").val(newResult.map(function (c) {
						return String.fromCharCode(97 + c);
					}).join(""));
				}

				// Convert result to array
				var resultString = $("#passphrase-result").val().toLowerCase();
				var result = [];
				for (var i = 0; i < resultString.length; ++i) {
					result.push(resultString.charCodeAt(i) - 97);
				}
				result = result.filter(function (c) { return c >= 0 && c < 26; });

				var entropy = Math.floor(result.length*Math.log(26) / Math.log(2));
				$("#passphrase-entropy")
					.text("(" + entropy + " bits entropy)")
					.css("color", getColorForEntropy(entropy));

				var partitions = result.length === 1 ? [[1]]
					: _(partition(result.length, currentList.words.length))
							.sortBy("length")
							.slice(0, MAX_MNEMONIC_SENTENCES)
							.value();

				var mnemonics = partitions.map(function (partition) {
					var resultStart = 0;
					var sentences = partition.map(function (sentenceLength) {
						var sentence = createSentence(
							currentList.sentences[sentenceLength-1],
							result.slice(resultStart, resultStart + sentenceLength),
							currentList.words);
						resultStart += sentenceLength;
						return sentence;
					});
					return sentences.join(" ");
				});
				$("#passphrase-mnemonics").empty().append(mnemonics.map(function (mnemonic) { 
					return $("<li>" + mnemonic + "</li>");
				}));
			}
		}

		function loadList() {
			currentList = undefined;
			setControlsEnabled(false);
			var list = lists[$("#passphrase-lists").val()];
			$.ajax(list.url)
				.then(function (result) {
					currentList = result;
				})
				.fail(function (req) {
					console.log(req); // eslint-disable-line no-console
				})
				.always(function () {
					setControlsEnabled(true);
					update(true);
				});
		}

		$("#passphrase-lists").append(lists.map(function (val, i) {
			return $("<option />").val(i).text(val.name);
		}));

		$("#passphrase-count").on("change", function () { update(true); });
		$("#passphrase-refresh").on("click", function () { update(true); });
		$("#passphrase-result").on("input", function () { update(false); });

		loadList();
	})();
});

