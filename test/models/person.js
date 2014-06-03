//
// Person model tests. These are basically CRUD tests, ordered to let us test
// all cases, plus listing all persons and following/unfollowing between persons.
//
// It's worth noting that there may already be persons in the database, so these
// tests must not assume the initial state is empty.
//
// High-level test plan:
//
// - List initial persons.
// - Create a person A.
// - Fetch person A. Should be the same.
// - List persons again; should be initial list plus person A.
// - Update person A, e.g. its name.
// - Fetch person A again. It should be updated.
// - Delete person A.
// - Try to fetch person A again; should fail.
// - List persons again; should be back to initial list.
//
// - Create two persons in parallel, B and C.
// - Fetch both person's "following and others"; both should show no following.
// - Have person B follow person C.
// - Have person B follow person C again; should be idempotent.
// - Fetch person B's "following and others"; should show following person C.
// - Fetch person C's "following and others"; should show not following person B.
// - Have person B unfollow person C.
// - Have person B unfollow person C again; should be idempotent.
// - Fetch both persons' "following and others" again; both should follow none.
//
// - Create a person D.
// - Have person B follow person C follow person D.
// - Fetch all persons' "following and others"; should be right.
// - Delete person B.
// - Fetch person C's and D's "following and others"; should be right.
// - Delete person D.
// - Fetch person C's "following and others"; should be right.
// - Delete person C.
//
// NOTE: I struggle to translate this kind of test plan into BDD style tests.
// E.g. what am I "describing", and what should "it" do?? Help welcome! =)
//


var expect = require('chai').expect;
var Person = require('../../models/person');


// Shared state:

var INITIAL_USERS;
var USER_A, USER_B, USER_C, USER_D;


// Helpers:

/**
 * Asserts that the given object is a valid person model.
 * If an expected person model is given too (the second argument),
 * asserts that the given object represents the same person with the same data.
 */
function expectPerson(obj, person) {
    expect(obj).to.be.an('object');
    expect(obj).to.be.an.instanceOf(Person);

    if (person) {
        ['id', 'name'].forEach(function (prop) {
            expect(obj[prop]).to.equal(person[prop]);
        });
    }
}

/**
 * Asserts that the given array of persons contains the given person,
 * exactly and only once.
 */
function expectPersonsToContain(persons, expPerson) {
    var found = false;

    expect(persons).to.be.an('array');
    persons.forEach(function (actPerson) {
        if (actPerson.id === expPerson.id) {
            expect(found, 'Person already found').to.equal(false);
            expectPerson(actPerson, expPerson);
            found = true;
        }
    });
    expect(found, 'Person not found').to.equal(true);
}

/**
 * Asserts that the given array of persons does *not* contain the given person.
 */
function expectPersonsToNotContain(persons, expPerson) {
    expect(persons).to.be.an('array');
    persons.forEach(function (actPerson) {
        expect(actPerson.id).to.not.equal(expPerson.id);
    });
}

/**
 * Fetches the given person's "following and others", and asserts that it
 * reflects the given list of expected following and expected others.
 * The expected following is expected to be a complete list, while the
 * expected others may be a subset of all persons.
 * Calls the given callback (err, following, others) when complete.
 */
function expectPersonToFollow(person, expFollowing, expOthers, callback) {
    person.getFollowingAndOthers(function (err, actFollowing, actOthers) {
        if (err) return callback(err);

        expect(actFollowing).to.be.an('array');
        expect(actFollowing).to.have.length(expFollowing.length);
        expFollowing.forEach(function (expFollowingPerson) {
            expectPersonsToContain(actFollowing, expFollowingPerson);
        });
        expOthers.forEach(function (expOtherPerson) {
            expectPersonsToNotContain(actFollowing, expOtherPerson);
        });

        expect(actOthers).to.be.an('array');
        expOthers.forEach(function (expOtherPerson) {
            expectPersonsToContain(actOthers, expOtherPerson);
        });
        expFollowing.forEach(function (expFollowingPerson) {
            expectPersonsToNotContain(actOthers, expFollowingPerson);
        });

        // and neither list should contain the person itself:
        expectPersonsToNotContain(actFollowing, person);
        expectPersonsToNotContain(actOthers, person);

        return callback(null, actFollowing, actOthers);
    });
}


// Tests:

describe('Person models:', function () {

    // Single person CRUD:

    it('List initial persons', function (next) {
        Person.getAll(function (err, persons) {
            if (err) return next(err);

            expect(persons).to.be.an('array');
            persons.forEach(function (person) {
                expectPerson(person);
            });

            INITIAL_USERS = persons;
            return next();
        });
    });

    it('Create person A', function (next) {
        var name = 'Test Person A';
        Person.create({name: name}, function (err, person) {
            if (err) return next(err);

            expectPerson(person);
            expect(person.id).to.be.a('number');
            expect(person.name).to.be.equal(name);

            USER_A = person;
            return next();
        });
    });

    it('Fetch person A', function (next) {
        Person.get(USER_A.id, function (err, person) {
            if (err) return next(err);
            expectPerson(person, USER_A);
            return next();
        });
    });

    it('List persons again', function (next) {
        Person.getAll(function (err, persons) {
            if (err) return next(err);

            // the order isn't part of the contract, so we just test that the
            // new array is one longer than the initial, and contains person A.
            expect(persons).to.be.an('array');
            expect(persons).to.have.length(INITIAL_USERS.length + 1);
            expectPersonsToContain(persons, USER_A);

            return next();
        });
    });

    it('Update person A', function (next) {
        USER_A.name += ' (edited)';
        USER_A.save(function (err) {
            return next(err);
        });
    });

    it('Fetch person A again', function (next) {
        Person.get(USER_A.id, function (err, person) {
            if (err) return next(err);
            expectPerson(person, USER_A);
            return next();
        });
    });

    it('Delete person A', function (next) {
        USER_A.del(function (err) {
            return next(err);
        });
    });

    it('Attempt to fetch person A again', function (next) {
        Person.get(USER_A.id, function (err, person) {
            expect(person).to.not.exist;  // i.e. null or undefined
            expect(err).to.be.an('object');
            expect(err).to.be.an.instanceOf(Error);
            return next();
        });
    });

    it('List persons again', function (next) {
        Person.getAll(function (err, persons) {
            if (err) return next(err);

            // like before, we just test that this array is now back to the
            // initial length, and *doesn't* contain person A.
            expect(persons).to.be.an('array');
            expect(persons).to.have.length(INITIAL_USERS.length);
            expectPersonsToNotContain(persons, USER_A);

            return next();
        });
    });

    // Two-person following:

    it('Create persons B and C', function (next) {
        var nameB = 'Test Person B';
        var nameC = 'Test Person C';

        function callback(err, person) {
            if (err) return next(err);

            expectPerson(person);

            switch (person.name) {
                case nameB:
                    USER_B = person;
                    break;
                case nameC:
                    USER_C = person;
                    break;
                default:
                    // trigger an assertion error:
                    expect(person.name).to.equal(nameB);
            }

            if (USER_B && USER_C) {
                return next();
            }
        }

        Person.create({name: nameB}, callback);
        Person.create({name: nameC}, callback);
    });

    it('Fetch person B’s “following and others”', function (next) {
        expectPersonToFollow(USER_B, [], [USER_C], function (err, following, others) {
            if (err) return next(err);

            // our helper tests most things; we just test the length of others:
            expect(others).to.have.length(INITIAL_USERS.length + 1);

            return next();
        });
    });

    it('Fetch person C’s “following and others”', function (next) {
        expectPersonToFollow(USER_C, [], [USER_B], function (err, following, others) {
            if (err) return next(err);

            // our helper tests most things; we just test the length of others:
            expect(others).to.have.length(INITIAL_USERS.length + 1);

            return next();
        });
    });

    it('Have person B follow person C', function (next) {
        USER_B.follow(USER_C, function (err) {
            return next(err);
        });
    });

    it('Have person B follow person C again', function (next) {
        USER_B.follow(USER_C, function (err) {
            return next(err);
        });
    });

    it('Fetch person B’s “following and others”', function (next) {
        expectPersonToFollow(USER_B, [USER_C], [], next);
    });

    it('Fetch person C’s “following and others”', function (next) {
        expectPersonToFollow(USER_C, [], [USER_B], next);
    });

    it('Have person B unfollow person C', function (next) {
        USER_B.unfollow(USER_C, function (err) {
            return next(err);
        });
    });

    // NOTE: skipping this actually causes the next two tests to fail!
    it('Have person B unfollow person C again', function (next) {
        USER_B.unfollow(USER_C, function (err) {
            return next(err);
        });
    });

    it('Fetch person B’s “following and others”', function (next) {
        expectPersonToFollow(USER_B, [], [USER_C], next);
    });

    it('Fetch person C’s “following and others”', function (next) {
        expectPersonToFollow(USER_C, [], [USER_B], next);
    });

    // Multi-person-following deletions:

    it('Create person D', function (next) {
        var name = 'Test Person D';
        Person.create({name: name}, function (err, person) {
            if (err) return next(err);

            expectPerson(person);
            expect(person.name).to.be.equal(name);

            USER_D = person;
            return next();
        });
    });

    it('Have person B follow person C follow person D', function (next) {
        var remaining = 2;

        function callback(err) {
            if (err) return next(err);
            if (--remaining === 0) {
                next();
            }
        }

        USER_B.follow(USER_C, callback);
        USER_C.follow(USER_D, callback);
    });

    it('Fetch all person’s “following and others”', function (next) {
        var remaining = 3;

        function callback(err) {
            if (err) return next(err);
            if (--remaining === 0) {
                next();
            }
        }

        expectPersonToFollow(USER_B, [USER_C], [USER_D], callback);
        expectPersonToFollow(USER_C, [USER_D], [USER_B], callback);
        expectPersonToFollow(USER_D, [], [USER_B, USER_C], callback);
    });

    it('Delete person B', function (next) {
        USER_B.del(function (err) {
            return next(err);
        });
    });

    it('Fetch person C’s and D’s “following and others”', function (next) {
        var remaining = 2;

        function callback(err) {
            if (err) return next(err);
            if (--remaining === 0) {
                next();
            }
        }

        expectPersonToFollow(USER_C, [USER_D], [], callback);
        expectPersonToFollow(USER_D, [], [USER_C], callback);
    });

    it('Delete person D', function (next) {
        USER_D.del(function (err) {
            return next(err);
        });
    });

    it('Fetch person C’s “following and others”', function (next) {
        expectPersonToFollow(USER_C, [], [], next);
    });

    it('Delete person C', function (next) {
        USER_C.del(function (err) {
            return next(err);
        });
    });

});
