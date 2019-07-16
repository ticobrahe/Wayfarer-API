import moment from 'moment';
import { pool } from '../services/db';

exports.bookTrip = async (req, res) => {
  const { user_id } = req.user;
  const queryTrip = 'SELECT bus_id, status from trips where trip_id = $1';
  const client = await pool.connect();
  try {
    const queryUser = 'SELECT user_id, trip_id from bookings where user_id = $1 and trip_id = $2';
    const resultUser = await client.query(queryUser, [user_id, req.body.trip_id]);
    // Check if user has alrady booked a trip
    if (resultUser.rows[0]) {
      return res.status(400).send({
        status: 'error',
        error: 'Trip has alrealdy been booked by you',
      });
    } 
    const tripResult = await client.query(queryTrip, [req.body.trip_id]);
    const busId = tripResult.rows[0].bus_id;
    // Check if trip is avalaible
    if (tripResult.rows[0].status === false) {
      return res.status(400).send({
        status: 'error',
        error: 'This trip is not available',
      });
    }
    const queryBooking = 'select max(seat_number) from bookings where trip_id = $1';
    // get last seat number for the trip
    const bookingResult = await client.query(queryBooking, [req.body.trip_id]);
    let seatNumber = 0;
    // check if any user has booked for this trip
    if (bookingResult.rows[0].max) {
      seatNumber = bookingResult.rows[0].max;
    } else {
      seatNumber = 1;
    }
    const data = [
      req.body.trip_id,
      user_id,
      seatNumber,
      moment(new Date()),
    ];
    const queryBus = 'SELECT capacity from buses where bus_id = $1';
    const resultBus = await client.query(queryBus, [busId]);
    if (resultBus.rows[0].capacity === seatNumber) {
      return res.status(400).send({
        status: 'error',
        error: 'Bus has been fully booked',
      });
    }
    const query = `INSERT INTO
        bookings(trip_id, user_id, seat_number, created_on)
        VALUES($1, $2, $3, $4) returning *`;
    const result = await client.query(query, data);
    const queryJoin = `select b.booking_id,
        u.user_id,
        t.trip_id,
        t.bus_id,
        t.trip_date,
        b.seat_number,
        u.first_name,
        u.last_name,
        u.email from users u
        inner join bookings b on b.user_id = $1
        inner join trips t on b.trip_id = $2`;
    const queryData = [result.rows[0].user_id, result.rows[0].trip_id];
    const resultJoin = await client.query(queryJoin, queryData);
    console.log(resultJoin.rows[0]);
    return res.status(200).send({ status: 'success', data: resultJoin.rows[0] });
  } catch (error) {
    return res.status(400).send({ status: 'error', error });
  }
};