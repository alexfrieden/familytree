// persons.js
// Routes to CRUD persons.

var Person = require('../models/person');

/**
 * GET /persons
 */
exports.list = function (req, res, next) {
    Person.getAll(function (err, persons) {
        if (err) return next(err);
        res.render('persons', {
            persons: persons
        });
    });
};

/**
 * POST /persons
 */
exports.create = function (req, res, next) {
    Person.create({
        name: req.body['name']
    }, function (err, person) {
        if (err) return next(err);
        res.redirect('/persons/' + person.id);
    });
};

/**
 * GET /persons/:id
 */
exports.show = function (req, res, next) {
    Person.get(req.params.id, function (err, person) {
        if (err) return next(err);
        // TODO also fetch and show followers? (not just follow*ing*)
        person.getRelatedAndOthers(function (err, related, relations, others) {
            if (err) return next(err);
            console.log(relations.length);
            res.render('person', {
                person: person,
                related: related,
                relations: relations,
                others: others
            });
        });
    });
};

/**
 * POST /persons/:id
 */
exports.edit = function (req, res, next) {
    Person.get(req.params.id, function (err, person) {
        if (err) return next(err);
        person.name = req.body['name'];
        person.save(function (err) {
            if (err) return next(err);
            res.redirect('/persons/' + person.id);
        });
    });
};

/**
 * DELETE /persons/:id
 */
exports.del = function (req, res, next) {
    Person.get(req.params.id, function (err, person) {
        if (err) return next(err);
        person.del(function (err) {
            if (err) return next(err);
            res.redirect('/persons');
        });
    });
};

/**
 * POST /persons/:id/relate
 */
exports.relate = function (req, res, next) {
    Person.get(req.params.id, function (err, person) {
        if (err) return next(err);
        Person.get(req.body.person.id, function (err, other) {
            if (err) return next(err);
            var rel = req.body.relation;
            person.relate(other, rel, function (err) {
                if (err) return next(err);

                res.redirect('/persons/' + person.id);
            });
        });
    });
};

/**
 * POST /persons/:id/unrelate
 */
exports.unrelate = function (req, res, next) {
    Person.get(req.params.id, function (err, person) {
        if (err) return next(err);
        Person.get(req.body.person.id, function (err, other) {
            if (err) return next(err);
            person.unrelate(other, function (err) {
                if (err) return next(err);
                res.redirect('/persons/' + person.id);
            });
        });
    });
};
