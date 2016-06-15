var fs = require('fs');
var http = require('http');
var request = require('request');
var nude = require('nude');
var imageExists = require('image-exists');
var ImageStreamValidation = require('image-validator-stream');
var uu = require('url-unshort');
var phantom = require('phantom-render-stream');
var render = phantom();
var unshort = new uu();
var HackChat = require("./hackchat.js");
var chat = new HackChat();
var config = require("./config.json");
var userStats = require("./userStats.json");
var users = {};
var links = [];
var connections = {};
connections[config.botChannel] = chat.join(config.botChannel, config.botName, config.botPass);

setInterval(function() {
    fs.writeFileSync("./userStats.json", JSON.stringify(userStats, undefined, 4));
}, 5 * 60 * 60 * 1000);
setInterval(function() {
    for (var session in connections){
      connections[session].ping();
    }
}, 3 * 60 * 1000);

chat.on("chat", function(session, nick, text, time, isAdmin, trip) {
    if (nick != config.botName && nick != "pornBot") {
        if (text.toLowerCase().indexOf(config.botName.toLowerCase()) != -1) {
            if (text.indexOf('stfu') != -1 || text.indexOf('shut') != -1) {
                session.sendMessage('@' + nick + ' no, you shut up!');
            } else if (text.indexOf('fuck') != -1) {
                session.sendMessage('@' + nick + ' fuck you too!');
            }
            else if (text.indexOf('sorry') != -1 || text.indexOf('sry') != -1) {
                session.sendMessage('@' + nick + " it's okay, don't let it happen again :)");
            }
        }
        if (config.ignore.indexOf(trip) == -1) {
            if (trip !== 'undefined')
                nick = nick + "#" + trip;
            if (typeof userStats[nick] == 'undefined')
                userStats[nick] = {
                    "banCount": 0,
                    "warningCount": 0
                };
            if (typeof users[nick] != 'undefined')
                try {
                    users[nick].push([time, text]);
                } catch (e) {
                    console.log(e);
                }
            else {
                users[nick] = [];
                users[nick].push([time, text]);
            }
            var outPutMessage = '';
            outPutMessage += linkCheck(session, text, nick) || '';
            outPutMessage += reEvaluate(nick) || '';
            if (outPutMessage !== '')
                session.sendMessage(outPutMessage);
            setTimeout(function() {
                users[nick].shift();
            }, 5 * 60 * 1000); //Substract a message counter after 5 minutes
        }
    }
    if (text.split(" ")[0] == ".stats") {
        if (typeof text.split(' ')[1] != 'undefined' && config.mods.indexOf(trip) != -1) {
            var matches = getName(text.split(' ')[1]);
            var message = "@" + nick + " \n";
            if (matches.length > 1) {
                for (var user of matches)
                    message += user + " ~ banCount: " + userStats[user].banCount + " warningCount: " + userStats[user].warningCount + "\n";
                session.sendMessage(message);
            }
        } else
            session.sendMessage("@" + nick + " ~ banCount: " + userStats[nick].banCount + " warningCount: " + userStats[nick].warningCount + "\n");
    } else if (text == ".allStats" && config.mods.indexOf(trip) != -1) {
        var message = "";
        for (var name in userStats)
            if (userStats[name].banCount !== 0 || userStats[name].warningCount !== 0)
                message += name + " ~ banCount: " + userStats[name].banCount + " warningCount: " + userStats[name].warningCount + "\n";
        session.sendMessage(message);
    } else if (text == ".save" && config.mods.indexOf(trip) != -1) {
        fs.writeFile("./userStats.json", JSON.stringify(userStats), function() {});
    } else if (text.split(" ")[0] == ".ban" && config.mods.indexOf(trip) != -1) {
        var target = text.split(" ")[1];
        if (target[0] == '@')
            target.shift();
        if (config.banIgnore.indexOf(target) != -1)
            return;
        session.channel.sendRaw({
            cmd: "ban",
            nick: text.split(" ")[1]
        });
    } else if (text.split(" ")[0] == ".reload" && config.mods.indexOf(trip) != -1) {
        config = require("./config.json");
    } else if (text.split(" ")[0] == ".join" && config.mods.indexOf(trip) != -1) {
        connections[text.split(" ")[1]] = chat.join(text.split(" ")[1], config.botName, config.botPass);
    } else if (text.split(" ")[0] == ".leave" && config.mods.indexOf(trip) != -1) {
        console.log(session.channel)
        if (session.channel == config.botChannel)
            return;
        connections[session.channel].leave();
        delete connections[session.channel];
    } else if (text == ".source") {
        session.sendMessage(config.botName + " is written by ToastyStoemp, the source code  can be found here: https://github.com/ToastyStoemp/modBot ");
    } else if (text == "o/") {
        session.sendMessage("\\o");
    }
});

chat.on("joining", function(session) {
    console.log('joined ' + session.channel);
});

chat.on("info", function(session, text, time) {
    var words = text.split(" ");
    if (words[0] == "Banned") {
        for (user of getName(words[1]))
            userStats[user].banStatus++;
    }
});
chat.on("nicknameTaken", function() {
    console.log('nicknameTaken');
});

chat.on("ratelimit", function() {
    console.log("Rate limit");
});

function linkCheck(session, text, nick) {
    var output = '';
    var urls = text.match(/(https?:\/\/)\S+?(?=[,.!?:)]?\s|$)/g);
    if (urls) {
        for (var url of urls) {
            if (links.indexOf(url) == -1) {
                links.push(url);
                setTimeout(function() {
                    links.shift();
                }, 10 * 60 * 1000); //Substract a link after 1 minutes
                request('https://sb-ssl.google.com/safebrowsing/api/lookup?client=demo-app&key=' + config.gooleApiKey + '&appver=1.5.2&pver=3.1&url=' + url, function(error, response, body) {
                    if (!error && response.statusCode == 200) {
                        userStats[nick].warningCount++;
                        console.log('User: ' + nick + ' has been deteced for ' + body + ' link.');
                        session.sendMessage("@" + nick + " $\\color{orange}{warning}$ #" + userStats[nick].warningCount + ": this link has been flagged as $\\color{red}{" + body + "}$\n");
                    }
                });
                unshort.expand(url, function(err, urlnew) {
                    if (urlnew) {
                        urlDomain = urlnew.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n]+)/im)[1];
                        urlName = urlDomain.split('.')[0] + Math.floor(Math.random() * 1000);
                        render(urlnew, {
                                format: 'jpg',
                                quality: 100,
                                width: 1280,
                                height: 960,
                                timeout: 1000
                            })
                            .on('error', function() {
                                session.sendMessage("Target domain is: " + urlDomain + "\nPrieview could not be generated");
                            })
                            .pipe(fs.createWriteStream('/var/www/html/i/' + urlName + '.jpg'))
                            .on('close', function() {
                                session.sendMessage("Target domain is: " + urlDomain + "\nWebsite preview: " + config.domain + urlName + ".jpg");
                                setTimeout(function() {
                                    fs.unlink('/var/www/html/i/' + urlName + '.jpg')
                                }, 5 * 60 * 60 * 1000); //remove file after 1 hour
                            });
                    } else {
                        if (url.match(/(?:jpe?g|png)/g)) {
                            scanFile(session, url, text);
                        } else {
                            urlName = url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n]+)/im)[1].split('.')[0] + Math.floor(Math.random() * 1000);
                            render(url, {
                                    format: 'jpg',
                                    quality: 100,
                                    width: 1280,
                                    height: 960,
                                    timeout: 1000
                                })
                                .on('error', function() {
                                    return;
                                })
                                .pipe(fs.createWriteStream('/var/www/html/i/' + urlName + '.jpg'))
                                .on('close', function() {
                                    session.sendMessage("Website preview: " + config.domain + urlName + ".jpg");
                                    setTimeout(function() {
                                        fs.unlink('/var/www/html/i/' + urlName + '.jpg')
                                    }, 5 * 60 * 60 * 1000); //remove file after 1 hour
                                });
                        }
                    }
                });
            } else {
                userStats[nick].warningCount++;
                setTimeout(function() {
                    userStats[nick].warningCount--;
                }, 1 * 60 * 60 * 1000);
                console.log('User: ' + nick + ' has been deteced for repetitive links.');
                urlName = url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n]+)/im)[1];
                session.sendMessage("@" + nick + " $\\color{orange}{warning}$ #" + userStats[nick].warningCount + ": this link has been posted recently");
            }
        }
        return output;
    }
}

function reEvaluate(nick) {
    //Spam Region
    var maxMessages = 200; //Max amount of messages every 5 min
    var maxAvgtime = 1000; //Max difference that just baerly triggers the warning
    var maxSimilarityMultiLine = 0.75; //Max similarity between the first and third message
    var maxSimilaritySingleLine = 0.70; //Max similarity between the words in the text

    var firstMessage = users[nick][users[nick].length - 1][1];
    var thirdMessage = "";

    if (users[nick].length > 2)
        thirdMessage = users[nick][users[nick].length - 3][1];

    if (firstMessage.split(/\r\n|\r|\n/).length > 8) {
        userStats[nick].warningCount++;
        console.log('User: ' + nick + ' has been deteced for long text.');
        users[nick] = [];
        setTimeout(function() {
            userStats[nick].warningCount--;
        }, 1 * 60 * 60 * 1000);
        return ("@" + nick + " $\\color{orange}{warning}$ #" + userStats[nick].warningCount + ": long text, for code sharing use http://pastebin.com/ \n");
    } else if (users[nick].length > 2 && similar_text(firstMessage, thirdMessage) >= maxSimilarityMultiLine) { //Checking the repetiviness of messages
        userStats[nick].warningCount++;
        console.log('User: ' + nick + ' has been deteced for spamming.');
        users[nick] = [];
        setTimeout(function() {
            userStats[nick].warningCount--;
        }, 1 * 60 * 60 * 1000);
        return ("@" + nick + " $\\color{orange}{warning}$ #" + userStats[nick].warningCount + ": you are spamming!\n");
    } else if (similar_inlineText(users[nick][users[nick].length - 1][1], maxSimilaritySingleLine, maxSimilarityMultiLine)) {
        userStats[nick].warningCount++;
        console.log('User: ' + nick + ' has been deteced for spamming');
        users[nick] = [];
        setTimeout(function() {
            userStats[nick].warningCount--;
        }, 1 * 60 * 60 * 1000);
        return ("@" + nick + " $\\color{orange}{warning}$ #" + userStats[nick].warningCount + ": you are spamming!\n");
    } else if (users[nick].length - 1 > maxMessages) { //Checking the count of the last messages over the last 5 min
        userStats[nick].warningCount++;
        console.log('User: ' + nick + ' has been deteced for flooding the chat.');
        users[nick] = [];
        setTimeout(function() {
            userStats[nick].warningCount--;
        }, 1 * 60 * 60 * 1000);
        return ("@" + nick + " $\\color{orange}{warning}$ #" + userStats[nick].warningCount + ": you are typing too much ~ possible spam!\n");
    } else if (users[nick].length - 1 > 2) { //Checking the time difference between the last and third last message
        if (users[nick][users[nick].length - 1][0] - users[nick][users[nick].length - 3][0] < maxAvgtime) {
            userStats[nick].warningCount++;
            console.log('User: ' + nick + ' has been deteced for fast typing in the chat.');
            users[nick] = [];
            setTimeout(function() {
                userStats[nick].warningCount--;
            }, 1 * 60 * 60 * 1000);
            return ("@" + nick + " $\\color{orange}{warning}$ #" + userStats[nick].warningCount + ": you are typing too fast!\n");
        }
    }
}

function getName(nick) {
    var matches = [];
    for (var user in userStats) {
        if (user.indexOf(nick) != -1)
            matches.push(user);
    }
    return matches;
}

function similar_text(first, second) {
    if (first == second)
        return 1;

    firstArr = first.split(' ');
    for (var word in firstArr) {
        if (firstArr[word].indexOf('@') != -1)
            firstArr.splice(firstArr[word], 1);
        else
            firstArr[word] = firstArr[word].split('').sort().join('');
    }
    firstArr = firstArr.sort();

    secondArr = second.split(' ');
    for (word in secondArr) {
        if (secondArr[word].indexOf('@') != -1)
            secondArr.splice(secondArr[word], 1);
        else
            secondArr[word] = secondArr[word].split('').sort().join('');
    }
    secondArr = secondArr.sort();

    var similarityCounter = 0;
    for (word in first)
        if (first[word] == second[word])
            similarityCounter++;

    return similarityCounter / ((first.length + second.length) / 2.0);
}

function similar_inlineText(text, maxWordOccurence, maxSimilarity) {
    var checkedWords = [];
    var textArr = text.split(' ');
    if (textArr.length < 7)
        return false;
    for (var i = 0; i < textArr.length - 1; i++) {
        var wordCount = 1;
        if (checkedWords.indexOf(textArr[i]) == -1) {
            for (var k = i + 1; k < textArr.length; k++)
                if (textArr[i] == textArr[k] || similar_text(textArr[i], textArr[k]) > maxSimilarity)
                    wordCount++;
            if (wordCount / textArr.length >= maxWordOccurence)
                return true;
        }
        checkedWords.push(textArr[i]);
    }
    return false;
}

scanFile = function(session, url, message) {
    var download = function(uri, filename, callback) {
        var valid = true;
        request.get(url)
            .on('response', function(response) {
                if (response.statusCode != 200)
                    valid = false;
                if (response.headers['content-type'].indexOf('image') == -1) // 'image/png'
                    valid = false;
            })
            .pipe(fs.createWriteStream(filename))
            .on('close', function() {
                if (valid) {
                    try {
                        imageExists(filename, function(exists) {
                            if (exists) {
                                nude.scan(filename, function(res) {
                                    var fileName = url.split("/");
                                    fileName = fileName[fileName.length - 1];
                                    fs.rename(filename, '/var/www/html/i/' + fileName);
                                    var message = "";
                                    if (message.toLowerCase().indexOf("nsfw") == -1 && res) {
                                        message += fileName + " flagged as possible [NSFW]\n";
                                    }
                                    session.sendMessage(message + "Alternative link: " + config.domain + fileName + " available for 1 hour.");
                                    setTimeout(function() {
                                        fs.unlink('/var/www/html/i/' + fileName)
                                    }, 1 * 60 * 60 * 1000); //remove file after 1 hour
                                });
                            }
                        });
                    } catch (e) {
                        console.log(e + "\nYour server might be out of memory (RAM)");
                    }
                }
            });
    };
    download(url, 'temp.jpg');
};
