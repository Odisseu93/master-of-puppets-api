import { IExecutionRepository } from '../repositories/execution.repository';
import { Execution } from '../types';

export class GetExecutionService {
  constructor(private executionRepo: IExecutionRepository) {}

  async execute(id: string): Promise<Execution> {
    const execution = await this.executionRepo.findById(id);
    if (!execution) {
      throw new Error('Execution not found');
    }
    return execution;
  }
}
