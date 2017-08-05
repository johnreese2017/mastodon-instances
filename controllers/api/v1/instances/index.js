const router = require('express').Router();
const APIUtils = require('../../../../helpers/APIUtils');

// https://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript/3561711#3561711
RegExp.escape = function(s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
};

/**
 * @api {get} /instances/show Show instance information
 * @apiName ShowInstance
 * @apiGroup Instances
 * @apiVersion 1.0.0
 *
 * @apiParam {String} name Instance name.
 */
router.get('/show', (req, res) => {
    let query;
    try {
        query = APIUtils.checkQuery({
            name: {
                type: 'string'
            }
        }, req.query);
    } catch(e) {
        return res.sendError(400, e.message);
    }

    DB.get('instances').findOne({
        name: query.name
    }).then((instance) => {
        if(!instance)
            return res.sendError(404, 'Instance not found.');

        res.json(APIUtils.createInstanceJson(instance));
    }).catch((err) => {
        console.error(err);
        res.sendStatus(500);
    });
});

/**
 * @api {get} /instances/list List instances
 * @apiName ListInstances
 * @apiGroup Instances
 * @apiVersion 1.0.0
 *
 * @apiParam {Number} [count=20] Number of instances to get. **0 returns all instances**.
 * @apiParam {Boolean} [include_dead=false] Include dead (down for at least two weeks) instances
 * @apiParam {String} [min_id] Minimal ID of instances to retrieve. Use this to navigate through pages. The id of the first instance from next page is accessible through pagination.next_id.
 */
router.get('/list', (req, res) => {
    let query;
    try {
        query = APIUtils.checkQuery({
            count: {
                type: 'int',
                min: 0,
                optional: true,
                def: 20
            }, min_id: {
                type: 'string',
                optional: true
            }, include_dead: {
                type: 'boolean',
                optional: true,
                def: false
            }
        }, req.query);
    } catch(e) {
        return res.sendError(400, e.message);
    }

    let q = {
        upchecks: {
            $gt: 0
        },
        blacklisted: {
            $ne: true
        }
    };

    if(!query.include_dead)
        q.dead = {
            $ne: true
        };

    if(query.min_id)
        try {
            q._id = {
                $gte: require('monk').id(query.min_id)
            };
        } catch(e) {}

    let limited = query.count > 0;
    Promise.all([DB.get('instances').count(q), DB.get('instances').find(q, limited ? {
        limit: query.count + 1
    } : undefined)]).then(values => {
        let total = values[0];
        let instances = values[1];

        let jsons = [];

        instances.slice(0, limited ? query.count : undefined).forEach((instance) => {
            jsons.push(APIUtils.createInstanceJson(instance));
        });

        let res_json = {
            instances: jsons,
            pagination: {
                total
            }
        };

        if(limited && instances.length > query.count)
            res_json.pagination.next_id = instances[query.count]._id;

        res.json(res_json);
    }).catch((err) => {
        console.error(err);
        res.sendStatus(500);
    });
});

/**
 * @api {get} /instances/search Search instances
 * @apiName SearchInstances
 * @apiGroup Instances
 * @apiVersion 1.0.0
 *
 * @apiParam {Number} [count=20] Number of instances to get. **0 returns all instances**.
 * @apiParam {String} q Query for searching through instance names, topics and descriptions.
 * @apiParam {Boolean} [name=false] Only search through names
 */
router.get('/search', (req, res) => {
    let query;
    try {
        query = APIUtils.checkQuery({
            count: {
                type: 'int',
                min: 0,
                optional: true,
                def: 20
            }, q: {
                type: 'string'
            }, name: {
                type: 'boolean',
                optional: true,
                def: false
            }
        }, req.query);
    } catch(e) {
        return res.sendError(400, e.message);
    }

    let or = [{
        name: {
            $regex: RegExp.escape(query.q),
            $options: 'i'
        }
    }];

    if(!query.name) {
        or.push({
            'infos.theme': {
                $regex: RegExp.escape(query.q),
                $options: 'i'
            }
        }, {
            'infos.shortDescription': {
                $regex: RegExp.escape(query.q),
                $options: 'i'
            }
        }, {
            'infos.fullDescription': {
                $regex: RegExp.escape(query.q),
                $options: 'i'
            }
        });
    }

    let q = {
        upchecks: {
            $gt: 0
        },
        blacklisted: {
            $ne: true
        },
        dead: {
            $ne: true
        },
        $or: or
    };

    let limited = query.count > 0;
    Promise.all([DB.get('instances').count(q), DB.get('instances').find(q, limited ? {
        limit: query.count + 1
    } : undefined)]).then(values => {
        let total = values[0];
        let instances = values[1];

        let jsons = [];

        instances.slice(0, limited ? query.count : undefined).forEach((instance) => {
            jsons.push(APIUtils.createInstanceJson(instance));
        });

        let res_json = {
            instances: jsons,
            pagination: {
                total
            }
        };

        if(limited && instances.length > query.count)
            res_json.pagination.next_id = instances[query.count]._id;

        res.json(res_json);
    }).catch((err) => {
        console.error(err);
        res.sendStatus(500);
    });
});

module.exports = router;