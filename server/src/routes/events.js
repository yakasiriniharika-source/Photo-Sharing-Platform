const express = require('express');
const { protect, restrictTo } = require('../middleware/auth');
const router = express.Router();
const { createEvent, getEvents, getEventById, addMember, getMembers, updateEvent, deleteEvent } = require('../controllers/eventController');


router.use(protect); // every route below requires login

router.post('/events', restrictTo('ADMIN'), createEvent);
router.get('/events', getEvents); // both roles allowed, query branches internally
router.get('/events/:id', getEventById);
router.post('/events/:id/members', restrictTo('ADMIN'), addMember);
router.get('/events/:id/members', getMembers);
router.patch('/events/:id', restrictTo('ADMIN'), updateEvent);
router.delete('/events/:id', restrictTo('ADMIN'), deleteEvent);

module.exports = router;