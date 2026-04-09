class BaseRepository {
  constructor() {
    if (new.target === BaseRepository) {
      throw new Error('Cannot instantiate abstract BaseRepository');
    }
  }

  async save(key, data) {
    throw new Error('Method save() must be implemented');
  }

  async findAll() {
    throw new Error('Method findAll() must be implemented');
  }

  async findByName(name) {
    throw new Error('Method findByName() must be implemented');
  }

  async deleteByName(name) {
    throw new Error('Method deleteByName() must be implemented');
  }
}

module.exports = BaseRepository;
