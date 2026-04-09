'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Bookings');

    if (!table.seats) {
      await queryInterface.addColumn('Bookings', 'seats', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }

    if (!table.metadata) {
      await queryInterface.addColumn('Bookings', 'metadata', {
        type: Sequelize.JSONB,
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('Bookings');

    if (table.metadata) {
      await queryInterface.removeColumn('Bookings', 'metadata');
    }

    if (table.seats) {
      await queryInterface.removeColumn('Bookings', 'seats');
    }
  }
};
