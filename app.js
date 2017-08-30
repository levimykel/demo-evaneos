/*jslint node: true */
/*jshint esnext: true */
"use strict";

const Prismic = require('prismic-javascript');
const { RichText, Link } = require('prismic-dom');
const app = require('./config');
const config = require('./prismic-configuration');
const PORT = app.get('port');
const Cookies = require('cookies');

app.listen(PORT, () => {
  console.log(`Go to browser: http://localhost:${PORT}`);
});

//Middleware catch all request, query Prismic API and configure everything for it
app.use((req, res, next) => {
  //init prismic context
  res.locals.ctx = {
    endpoint: config.apiEndpoint,
    linkResolver: config.linkResolver
  };
  //put RichText Helper from Prismic DOM to simplify convert RichText from json to html
  res.locals.RichText = RichText;
  //put Link helper from Prismic DOM to simplify getting url from link
  res.locals.Link = Link;

  Prismic.api(config.apiEndpoint, {
    accessToken: config.accessToken,
    req
  })
  .then((api) => {
    req.prismic = { api };
    //continue spreading request
    next();
  })
  .catch((error) => {
    //next with params handle error natively in express
    next(error.message);
  });
});


//redirect / to default language from i18n.json
app.get('/', (req, res) => {
  res.redirect('/perou/voyage/informations-pratiques/');
});

// Route for info pages
app.get('/:country/voyage/informations-pratiques/', (req, res, next) => {
  const country = req.params.country;
  
  req.prismic.api.getByUID("infos_pratiques", country)
  .then((page) => {
    if(!page) {
      res.status(404).send('page not found');
    } else {
      req.prismic.api.query([
        Prismic.Predicates.at('document.type', 'article'),
        Prismic.Predicates.at('my.article.country', page.id)
      ], { 'fetchLinks' : 'author.nom_de_l_auteur' }
      ).then((articles) => {
        res.render('info', { page, articles });
      });
    }
  })
  .catch((error) => {
    next(`error when retriving page ${error.message}`);
  });
});

// Route for info pages
app.get('/:country/voyage/informations-pratiques/:uid', (req, res, next) => {
  const uid = req.params.uid;
  
  req.prismic.api.getByUID("article", uid, { 'fetchLinks' : 'author.nom_de_l_auteur, author.photo_de_l_auteur' })
  .then((page) => {
    if(!page) {
      res.status(404).send('page not found');
    } else {
      res.render('article', { page });
    }
  })
  .catch((error) => {
    next(`error when retriving page ${error.message}`);
  });
});


//preview
app.get('/preview', (req, res) => {
  const token = req.query.token;
  if (token) {
    req.prismic.api.previewSession(token, config.linkResolver, '/')
    .then((url) => {
      const cookies = new Cookies(req, res);
      cookies.set(Prismic.previewCookie, token, { maxAge: 30 * 60 * 1000, path: '/', httpOnly: false });
      res.redirect(302, url);
    }).catch((err) => {
      res.status(500).send(`Error 500 in preview: ${err.message}`);
    });
  } else {
    res.send(400, 'Missing token from querystring');
  }
});