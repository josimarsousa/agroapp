// migrations/XXXXXXX-create-harvests-table.js

'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('harvests', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      product_id: {
        type: Sequelize.INTEGER,
        allowNull: false, // Permanece NOT NULL
        references: {
          model: 'Products',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE', // <<<<< MUDANÇA AQUI: de 'SET NULL' para 'CASCADE' ou 'RESTRICT'
      },
      quantity: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      category_id: {
        type: Sequelize.INTEGER,
        allowNull: true, // Permite NULL
        references: {
          model: 'Categories',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL', // <<<<< Permanece 'SET NULL' porque 'allowNull' é true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false, // Permanece NOT NULL
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE', // <<<<< MUDANÇA AQUI: de 'SET NULL' para 'CASCADE' ou 'RESTRICT'
      },
      harvest_date: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('harvests');
  },
};