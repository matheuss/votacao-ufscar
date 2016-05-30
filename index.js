'use strict';
const fs = require('fs');
const path = require('path');

const bodyParser = require('body-parser');
const execa = require('execa');
const express = require('express');
const got = require('got');
const jsdom = require('jsdom');
const MongoClient = require('mongodb').MongoClient;
const tmp = require('tmp');

const app = express();

const url = 'https://sistemas.ufscar.br/siga/consultasExternas/consulta-documentos/consulta-documentos.xhtml';
const jQueryUrl = 'https://ajax.googleapis.com/ajax/libs/jquery/2.2.3/jquery.min.js';

let votes;

const options = ['Sim', 'Não', '---'];

app.set('view engine', 'pug');

app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended: false}));

MongoClient.connect('mongodb://localhost/strike-ufscar', {promiseLibrary: Promise}).then(db => {
    votes = db.collection('votes');
}).catch(err => {
    setTimeout(() => {
        throw err;
    });
});

app.get('/', (req, res) => {
    console.log('index');
    res.render('index');
});

app.post('/vote', (req, res) => {
    const body = req.body;
    if (!body.strike || !body.locking) {
        return res.json({error: 'your vote cannot be blank'});
    }
    if (!body.code) {
        return res.json({error: 'you will not vote w/o a certificate'});
    }

    body.strike = body.strike || '---';
    body.locking = body.locking || '---';

    let invalid = false;
    [body.strike, body.locking].forEach(el => {
        if (options.indexOf(el) === -1) {
            invalid = true;
        }
    });
    if (invalid) {
        return res.json({error: 'invalid vote'});
    }

    jsdom.env(url, [jQueryUrl], (err, window) => {
        if (err) {
            return console.error(err);
        }
        const $ = window.jQuery;

        const submitButton = $('input[type="submit"]');
        const form = $(submitButton).parent();

        let data = `${$(form).serialize().replace('_____-_____-_____-_____-_____', '')}${body.code}&`;
        data += `${$(submitButton).attr('name').replace(':', '%3A')}`;

        const options = {
            method: 'POST',
            body: data,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Host': 'sistemas.ufscar.br',
                'Origin': 'https://sistemas.ufscar.br',
                'Referer': $(form)[0].action
            }
        };
        const file = tmp.fileSync().name;

        got.stream($(form)[0].action, options).pipe(fs.createWriteStream(file)).on('finish', () => {
            execa.stdout(path.join(__dirname, 'pdf.sh'), [file]).then(data => {
                console.log(data);
                data = data.replace('\n', ' ').replace('Atestamos, para os devidos fins, que', '').replace(' Nº ', '');
                data = data.replace('do curso de', '').replace(' ministrado no Campus', '');
                data = data.substring(0, data.indexOf(', reconhecido/autorizado')).split(',');
                data = data.map(el => el.trim());

                const vote = {strike: body.strike, locking: body.locking};
                vote.student = {name: data[0], RA: data[1], course: data[2], campus: data[3]};

                if (!data[3]) {
                    return res.json({error: 'invalid certificate'});
                }

                votes.updateOne({'student.RA': data[1]}, vote, {upsert: true}).then((r) => {
                    vote.new = r.upsertedCount === 1;
                    res.json(vote);
                }).catch(() => {
                    res.json({error: 'database'});
                });
            }).catch(err => {
                console.log(file);
                console.log(err);
                if (err.stderr.indexOf('Could not open')) {
                    res.json({error: 'invalid code'});
                } else {
                    res.json({error: 'unknown'});
                }
            });
        });
    });
});

app.get('/results', (req, res) => {
    const results = {strikeYes: 0, strikeNo: 0, lockingYes: 0, lockingNo: 0, total: 0, votes};
    votes.find({}).toArray().then(docs => {
        results.votes = docs.map(doc => {
            doc.student.RA = doc.student.RA.replace(/(\d)(?:\d{4})(\d)/, '$1****$2');

            results.total++;

            if (doc.strike === 'Sim') {
                results.strikeYes++;
            } else if (doc.strike === 'Não') {
                results.strikeNo++;
            }

            if (doc.locking === 'Sim') {
                results.lockingYes++;
            } else if (doc.locking === 'Não') {
                results.lockingNo++;
            }

            return doc;
        });

        res.render('results',{results});
    }).catch(err => res.end(err));
});

app.listen(3000, () => console.log('running'));
