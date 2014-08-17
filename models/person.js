// person.js
// Person model logic.

//var neo4j = require('neo4j');
//var db = new neo4j.GraphDatabase(
//    process.env['NEO4J_URL'] ||
//    process.env['GRAPHENEDB_URL'] ||
//    'http://localhost:7474'
//);
// https://github.com/thingdom/node-neo4j
          
          var neo4j = require("neo4j");
          var db = new neo4j.GraphDatabase("http://familyTree:9OzLwSwCVsr0NrOvQ2Ay@familytree.sb02.stations.graphenedb.com:24789");

// private constructor:

var Person = module.exports = function Person(_node) {
    // all we'll really store is the node; the rest of our properties will be
    // derivable or just pass-through properties (see below).
    this._node = _node;
}

// public instance properties:

Object.defineProperty(Person.prototype, 'id', {
    get: function () { return this._node.id; }
});

Object.defineProperty(Person.prototype, 'name', {
    get: function () {
        return this._node.data['name'];
    },
    set: function (name) {
        this._node.data['name'] = name;
    }
});

// public instance methods:

Person.prototype.save = function (callback) {
    this._node.save(function (err) {
        callback(err);
    });
};

Person.prototype.del = function (callback) {
    // use a Cypher query to delete both this person and his/her following
    // relationships in one transaction and one network request:
    // (note that this'll still fail if there are any relationships attached
    // of any other types, which is good because we don't expect any.)
    var query = [
        'MATCH (person:Person)',
        'WHERE ID(person) = {personId}',
        'DELETE person',
        'WITH person',
        'MATCH (person) -[rel:follows]- (other)',
        'DELETE rel',
    ].join('\n')

    var params = {
        personId: this.id
    };

    db.query(query, params, function (err) {
        callback(err);
    });
};

Person.prototype.relate = function (other, rel, callback) {
    this._node.createRelationshipTo(other._node, rel, {}, function (err, rel) {
        callback(err);
    });
};

Person.prototype.unrelate = function (other, callback) {
    var query = [
        'MATCH (person:Person) -[rel]-> (other:Person)',
        'WHERE ID(person) = {personId} AND ID(other) = {otherId}',
        'DELETE rel',
    ].join('\n')

    var params = {
        personId: this.id,
        otherId: other.id,
    };

    db.query(query, params, function (err) {
        callback(err);
    });
};

// calls callback w/ (err, following, others) where following is an array of
// persons this person follows, and others is all other persons minus him/herself.
Person.prototype.getRelatedAndOthers = function (callback) {
    // query all persons and whether we follow each one or not:
    var query = [
        'MATCH (person:Person)-[rel]->(other:Person)',
        'WHERE ID(person) = {personId}',
        'RETURN other, rel' // COUNT(rel) is a hack for 1 or 0
    ].join('\n')

    var params = {
        personId: this.id
    };
    var related = [];
    var relations = {};
    var others = [];
    var person = this;
    db.query(query, params, function (err, results) {
        if (err) return callback(err);



        for (var i = 0; i < results.length; i++) {
            var other = new Person(results[i]['other']);
            var follows = results[i]['COUNT(rel)'];
            var rel = results[i]['rel'];

            if (person.id === other.id) {
                continue;
            } else {
                console.log("adding person" + other.name);
                related.push(other);
                console.log(rel.type);
                relations[other.name] = rel.type;

            }
//            else {
//                others.push(other);
//            }
        }


    });
    query = [
        'MATCH (person:Person), (other:Person)',
        'WHERE NOT (person)--(other)',
        'AND ID(person) = {personId}',
        'AND ID(other) <> {personId}',
        'RETURN other;' // COUNT(rel) is a hack for 1 or 0
    ].join('\n');
    db.query(query, params, function (err, results) {
        if (err) return callback(err);
        others = results.map(function (result) {
            return new Person(result['other']);
        });
        callback(null, related, relations, others);
    });

};

// static methods:

Person.get = function (id, callback) {
    db.getNodeById(id, function (err, node) {
        if (err) return callback(err);
        callback(null, new Person(node));
    });
};

Person.getAll = function (callback) {
    var query = [
        'MATCH (person:Person)',
        'RETURN person',
    ].join('\n');

    db.query(query, null, function (err, results) {
        if (err) return callback(err);
        var persons = results.map(function (result) {
            return new Person(result['person']);
        });
        callback(null, persons);
    });
};

// creates the person and persists (saves) it to the db, incl. indexing it:
Person.create = function (data, callback) {
    // construct a new instance of our class with the data, so it can
    // validate and extend it, etc., if we choose to do that in the future:
    var node = db.createNode(data);
    var person = new Person(node);

    // but we do the actual persisting with a Cypher query, so we can also
    // apply a label at the same time. (the save() method doesn't support
    // that, since it uses Neo4j's REST API, which doesn't support that.)
    var query = [
        'CREATE (person:Person {data})',
        'RETURN person',
    ].join('\n');

    var params = {
        data: data
    };

    db.query(query, params, function (err, results) {
        if (err) return callback(err);
        var person = new Person(results[0]['person']);
        callback(null, person);
    });
};
