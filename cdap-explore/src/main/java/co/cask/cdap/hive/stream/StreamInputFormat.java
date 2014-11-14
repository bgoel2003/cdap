/*
 * Copyright © 2014 Cask Data, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

package co.cask.cdap.hive.stream;

import co.cask.cdap.data.stream.StreamInputFormatConfigurer;
import co.cask.cdap.data.stream.StreamInputSplitFactory;
import com.google.common.base.Throwables;
import org.apache.hadoop.fs.Path;
import org.apache.hadoop.io.ObjectWritable;
import org.apache.hadoop.mapred.InputFormat;
import org.apache.hadoop.mapred.InputSplit;
import org.apache.hadoop.mapred.JobConf;
import org.apache.hadoop.mapred.RecordReader;
import org.apache.hadoop.mapred.Reporter;

import java.io.IOException;
import java.util.List;
import javax.annotation.Nullable;

/**
 * Stream input format for use in hive queries.
 */
public class StreamInputFormat implements InputFormat<Void, ObjectWritable> {
  private static final StreamInputSplitFactory<InputSplit> splitFactory = new StreamInputSplitFactory<InputSplit>() {
    @Override
    public InputSplit createSplit(Path path, Path indexPath, long startTime, long endTime,
                                  long start, long length, @Nullable String[] locations) {
      return new StreamInputSplit(path, indexPath, startTime, endTime, start, length, locations);
    }
  };

  @Override
  public InputSplit[] getSplits(JobConf conf, int numSplits) throws IOException {
    try {
      List<InputSplit> splits = StreamInputFormatConfigurer.getSplits(conf, System.currentTimeMillis(), splitFactory);
      InputSplit[] splitArray = new InputSplit[splits.size()];
      int i = 0;
      for (InputSplit split : splits) {
        splitArray[i] = split;
        i++;
      }
      return splitArray;
    } catch (InterruptedException e) {
      throw Throwables.propagate(e);
    }
  }

  @Override
  public RecordReader<Void, ObjectWritable> getRecordReader(InputSplit split, JobConf conf, Reporter reporter)
    throws IOException {
    return new StreamRecordReader(split, conf);
  }
}
