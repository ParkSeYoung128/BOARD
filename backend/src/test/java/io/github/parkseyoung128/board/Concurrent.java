package io.github.parkseyoung128.board;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

/** 동시성 테스트용 유틸: 모든 작업을 같은 순간에 출발시키고, 하나라도 실패하면 그 예외를 던진다. */
public final class Concurrent {

    private static final long TIMEOUT_SECONDS = 60;

    private Concurrent() {
    }

    @FunctionalInterface
    public interface Task {
        void run(int index) throws Exception;
    }

    public static void run(int count, Task task) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(count);
        try {
            CountDownLatch ready = new CountDownLatch(count);
            CountDownLatch start = new CountDownLatch(1);
            List<Future<?>> futures = new ArrayList<>();
            for (int i = 0; i < count; i++) {
                int index = i;
                futures.add(pool.submit(() -> {
                    ready.countDown();
                    start.await();
                    task.run(index);
                    return null;
                }));
            }
            // 스레드 수 == 작업 수이므로 모두 준비되어야 정상이다. 아니면 조용히 넘어가지 않고 실패시킨다.
            if (!ready.await(TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
                throw new IllegalStateException("동시 작업이 제한 시간 안에 모두 준비되지 못했다");
            }
            start.countDown();
            for (Future<?> future : futures) {
                future.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            }
        } finally {
            pool.shutdownNow();
        }
    }
}
