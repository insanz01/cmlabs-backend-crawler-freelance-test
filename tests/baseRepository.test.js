const BaseRepository = require('../src/repositories/baseRepository');

describe('BaseRepository', () => {
  test('should throw when instantiated directly', () => {
    expect(() => new BaseRepository()).toThrow('Cannot instantiate abstract BaseRepository');
  });

  test('should allow subclass instantiation', () => {
    class TestRepo extends BaseRepository {
      async save() {}
      async findAll() {}
      async findByName() {}
      async deleteByName() {}
    }
    expect(() => new TestRepo()).not.toThrow();
  });

  test('subclass inherits abstract methods that throw', async () => {
    class IncompleteRepo extends BaseRepository {}
    const repo = Object.create(BaseRepository.prototype);
    repo.constructor = IncompleteRepo;

    await expect(repo.save()).rejects.toThrow('Method save() must be implemented');
    await expect(repo.findAll()).rejects.toThrow('Method findAll() must be implemented');
    await expect(repo.findByName()).rejects.toThrow('Method findByName() must be implemented');
    await expect(repo.deleteByName()).rejects.toThrow('Method deleteByName() must be implemented');
  });
});
