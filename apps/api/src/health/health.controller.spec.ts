import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();
    controller = moduleRef.get(HealthController);
  });

  it('returns ok status', () => {
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('splitsmart-api');
    expect(typeof result.timestamp).toBe('string');
  });
});
