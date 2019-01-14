---
title: Docker初步使用
date: 2018-06-11 21:32:36
tags: [docker,mysql]
---

​	之前一直听说Docker是个好东西，但是一直没仔细去了解一下，现在有了搭建环境的需求，发现使用Docker是真的方便。具体的教程这里有很详细的 [Docker从入门到实践](https://yeasy.gitbooks.io/docker_practice/)，就不细说了。这里说一点自己的理解。

### 虚拟机 VS Docker

​	Docker主要是解决软件的环境配置问题，与虚拟机相比，它更加轻量。虚拟机就是一台虚拟的电脑，而Docker只是对进程做了隔离，它直接使用系统的内核。这里可以说一下的是因为Docker从Linux发展而来，很多镜像都以Linux为基础，而Docker其实会使用系统的内核。所以Docker是肯定不能直接使用Windows内核的，安装Windows版本的Docker需要启用Hyper-v或者使用VirtualBox先安装一个Linux虚拟机然后使用它的内核。但因为这其中有很多优化，所以Windows使用Docker效率仍然会比用虚拟机强很多。
<!-- more -->

### Docker组成

​	主要包括了镜像、容器、仓库，简单使用的话其实主要是对镜像和容器的操作，而仓库可以用来搜索、下载镜像。

​	这里记一下几个最常用的指令

> docker container run -p 80:80 -dit --rm   image  # 运行指定的镜像，如果不存在则从官方库中下载
>
>  -p进行容器内外端口映射	  -d 指定后台运行	 -i 进行交互
>
>  -t 通过终端进行交互  --rm 运行结束后自动删除生成的镜像

​	进入容器的终端非常常用

> docker exec -it  containerid  bash	# 执行容器的bash指令，使用户进入shell



更新分界线 2018.10.14

------

### 解决mysql无法启动问题

以下部分参考自[moby issues](https://github.com/moby/moby/issues/34390) 

有时候会有将多服务部署在同一容器中的需求，但是自己安装的mysql有时候会有启动失败的情况，具体来说就是一直显示starting....然后静默失败,或者像下面

```dockerfile
docker build -t mysql-fails .
docker run -it mysql-fails /bin/bash -c 'service mysql start'
[FAIL] Starting MySQL database server: mysqld . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . failed!
```

总结一下，这个问题其实是因为写入权限的原因，mysql 启动的时候需要拥有 `/var/lib/mysql`目录的写权限，而docker构建的时候是分层构建的，所以当mysql启动的时候如果这个目录不可写就会出现这个问题。查看官方mysql的启动脚本其实也有类似处理：

```shell
RUN { \
		echo mysql-community-server mysql-community-server/data-dir select ''; \
		echo mysql-community-server mysql-community-server/root-pass password ''; \
		echo mysql-community-server mysql-community-server/re-root-pass password ''; \
		echo mysql-community-server mysql-community-server/remove-test-db select false; \
	} | debconf-set-selections \
	&& apt-get update && apt-get install -y mysql-server="${MYSQL_VERSION}" && rm -rf /var/lib/apt/lists/* \
	&& rm -rf /var/lib/mysql && mkdir -p /var/lib/mysql /var/run/mysqld \
	&& chown -R mysql:mysql /var/lib/mysql /var/run/mysqld \
# ensure that /var/run/mysqld (used for socket and lock files) is writable regardless of the UID our mysqld instance ends up having at runtime
	&& chmod 777 /var/run/mysqld
```

上述命令中先删除/var/lib/mysql，又进行创建，以此保证目录可写，所以解决这个问题有两种方式：

* 启动mysql前先执行`find /var/lib/mysql/mysql -exec touch -c -a {} + ` ，这是上面的issues中提到的，属于dirty hack的方式，具体来说这条命令其实什么也没干，只是修改了mysql这个目录下的文件时间，但是执行该命令后目录变得可写了
* **推荐** 使用匿名卷，`VOLUME /var/lib/mysql`在dockerfile中使用这样的语法,如果使用的时候不进行卷映射，将会自动映射匿名卷，这样更符合使用docker的推荐方式，即不将数据存储在存储层而是存储在卷中。

